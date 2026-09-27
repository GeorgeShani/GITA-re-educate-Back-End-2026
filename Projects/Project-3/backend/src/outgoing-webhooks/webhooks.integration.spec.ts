import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { InvoicingService } from '#/billing/invoicing.service.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { MAX_TASK_ATTEMPTS, computeBackoffMs } from '#/core/tasks/backoff.js';
import { TaskRunner } from '#/core/tasks/task-runner.service.js';
import { QuotaAlertsService } from '#/notifications/quota-alerts.service.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { WebhookDelivery } from './webhook-delivery.entity.js';
import { WebhookEndpoint } from './webhook-endpoint.entity.js';
import { WebhookPublisher } from './webhook-publisher.service.js';
import { verifyWebhookSignature } from './webhook-signature.js';

const createdSchema = z.object({
  id: z.uuid(),
  secret: z.string().startsWith('whsec_'),
});
const deliverySchema = z.object({ id: z.uuid(), status: z.string() });
const pageSchema = z.object({ data: z.array(z.object({ id: z.uuid() })) });

describe('outgoing webhooks (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  async function company(
    plan: 'free' | 'basic' | 'premium' = 'free',
  ): Promise<{ companyId: string; session: SessionBody }> {
    const account = await h.registerAndActivate();
    const session = await h.login(account.email);
    await h.subscribe(session, plan);
    return { companyId: account.companyId, session };
  }

  async function create(
    session: SessionBody,
    events: string[] = ['ping'],
    name = 'warehouse sync',
  ): Promise<{ id: string; secret: string }> {
    const acceptedEvents = events.filter((event) => event !== 'ping');
    const response = await h
      .http()
      .post('/outgoing-webhooks')
      .set(...h.bearer(session))
      .send({
        name,
        url: 'https://hooks.example.test/gridline',
        events: acceptedEvents.length > 0 ? acceptedEvents : ['file.uploaded'],
      })
      .expect(201);
    return createdSchema.parse(response.body);
  }

  it('shows the secret once, stores only ciphertext, and isolates management by tenant and role', async () => {
    const first = await company();
    const endpoint = await create(first.session);
    const stored = await h.dataSource
      .getRepository(WebhookEndpoint)
      .findOneByOrFail({ id: endpoint.id });

    expect(stored.encryptedSecret).not.toContain(endpoint.secret);
    expect(JSON.stringify(stored)).not.toContain(endpoint.secret);
    expect(
      pageSchema.parse(
        (
          await h
            .http()
            .get('/outgoing-webhooks')
            .set(...h.bearer(first.session))
            .expect(200)
        ).body,
      ).data,
    ).toHaveLength(1);

    const employee = await h.seedEmployee(first.companyId);
    const employeeSession = await h.login(employee.email);
    await h
      .http()
      .get('/outgoing-webhooks')
      .set(...h.bearer(employeeSession))
      .expect(403);
    const apiKey = await h.createApiKey(first.session, {
      scopes: ['files:read', 'files:write', 'billing:read'],
    });
    await h
      .http()
      .get('/outgoing-webhooks')
      .set('Authorization', `Bearer ${apiKey.key}`)
      .expect(403);

    const second = await company();
    expect(
      pageSchema.parse(
        (
          await h
            .http()
            .get('/outgoing-webhooks')
            .set(...h.bearer(second.session))
            .expect(200)
        ).body,
      ).data,
    ).toEqual([]);
    await h
      .http()
      .patch(`/outgoing-webhooks/${endpoint.id}`)
      .set(...h.bearer(second.session))
      .send({ name: 'stolen' })
      .expect(404);
  });

  it('enforces plan endpoint caps and blocks an invalid downgrade', async () => {
    const free = await company('free');
    await create(free.session);
    await h
      .http()
      .post('/outgoing-webhooks')
      .set(...h.bearer(free.session))
      .send({
        name: 'second',
        url: 'https://hooks.example.test/second',
        events: ['file.uploaded'],
      })
      .expect(409);

    const basic = await company('basic');
    await create(basic.session, ['file.uploaded'], 'one');
    await create(basic.session, ['report.ready'], 'two');
    await h
      .http()
      .patch('/subscriptions/me')
      .set(...h.bearer(basic.session))
      .send({ plan: 'free' })
      .expect(409)
      .expect((response) => {
        expect(
          z
            .object({ message: z.array(z.string()) })
            .parse(response.body)
            .message.join(' '),
        ).toMatch(/1 webhook endpoint/);
      });
  });

  it('signs the exact body, rotates secrets, lists deliveries, and redelivers', async () => {
    const account = await company();
    const endpoint = await create(account.session);
    const firstPing = deliverySchema.parse(
      (
        await h
          .http()
          .post(`/outgoing-webhooks/${endpoint.id}/ping`)
          .set(...h.bearer(account.session))
          .expect(202)
      ).body,
    );
    await h.drainTasks();

    const firstRequest = h.webhooks.requests[0];
    expect(firstRequest).toBeDefined();
    if (!firstRequest) return;
    expect(
      verifyWebhookSignature(
        endpoint.secret,
        firstRequest.headers['webhook-timestamp'] ?? '',
        firstRequest.body,
        firstRequest.headers['webhook-signature'] ?? '',
      ),
    ).toBe(true);
    expect(JSON.parse(firstRequest.body)).toMatchObject({
      type: 'ping',
      companyId: account.companyId,
      schemaVersion: 1,
    });

    const rotated = z
      .object({ id: z.uuid(), secret: z.string().startsWith('whsec_') })
      .parse(
        (
          await h
            .http()
            .post(`/outgoing-webhooks/${endpoint.id}/rotate-secret`)
            .set(...h.bearer(account.session))
            .expect(200)
        ).body,
      );
    await h
      .http()
      .post(`/outgoing-webhooks/${endpoint.id}/ping`)
      .set(...h.bearer(account.session))
      .expect(202);
    await h.drainTasks();
    const secondRequest = h.webhooks.requests[1];
    expect(secondRequest).toBeDefined();
    if (!secondRequest) return;
    const timestamp = secondRequest.headers['webhook-timestamp'] ?? '';
    const signature = secondRequest.headers['webhook-signature'] ?? '';
    expect(
      verifyWebhookSignature(
        rotated.secret,
        timestamp,
        secondRequest.body,
        signature,
      ),
    ).toBe(true);
    expect(
      verifyWebhookSignature(
        endpoint.secret,
        timestamp,
        secondRequest.body,
        signature,
      ),
    ).toBe(false);

    const listed = pageSchema.parse(
      (
        await h
          .http()
          .get(`/outgoing-webhooks/${endpoint.id}/deliveries`)
          .set(...h.bearer(account.session))
          .expect(200)
      ).body,
    );
    expect(listed.data).toHaveLength(2);
    await h
      .http()
      .post(`/outgoing-webhooks/deliveries/${firstPing.id}/redeliver`)
      .set(...h.bearer(account.session))
      .expect(202);
    await h.drainTasks();
    expect(h.webhooks.requests).toHaveLength(3);
  });

  it('retries five times, counts one terminal failure, and disables on the twentieth', async () => {
    const account = await company();
    const endpoint = await create(account.session);
    await h.dataSource
      .getRepository(WebhookEndpoint)
      .update(endpoint.id, { consecutiveFailures: 19 });
    for (let attempt = 0; attempt < MAX_TASK_ATTEMPTS; attempt += 1)
      h.webhooks.respondWith(500);
    const delivery = deliverySchema.parse(
      (
        await h
          .http()
          .post(`/outgoing-webhooks/${endpoint.id}/ping`)
          .set(...h.bearer(account.session))
          .expect(202)
      ).body,
    );
    const runner = h.app.get(TaskRunner);

    for (let attempt = 1; attempt <= MAX_TASK_ATTEMPTS; attempt += 1) {
      expect((await runner.drainOnce()).failed).toBe(1);
      if (attempt < MAX_TASK_ATTEMPTS)
        h.clock.advance(computeBackoffMs(attempt));
    }

    const failed = await h.dataSource
      .getRepository(WebhookDelivery)
      .findOneByOrFail({ id: delivery.id });
    const disabled = await h.dataSource
      .getRepository(WebhookEndpoint)
      .findOneByOrFail({ id: endpoint.id });
    expect(failed).toMatchObject({ status: 'failed', attempts: 5 });
    expect(disabled).toMatchObject({
      active: false,
      consecutiveFailures: 20,
    });
  });

  it('disables immediately on 410 and resets failures after a success', async () => {
    const first = await company();
    const gone = await create(first.session);
    h.webhooks.respondWith(410);
    await h
      .http()
      .post(`/outgoing-webhooks/${gone.id}/ping`)
      .set(...h.bearer(first.session))
      .expect(202);
    await h.drainTasks();
    expect(
      await h.dataSource
        .getRepository(WebhookEndpoint)
        .findOneByOrFail({ id: gone.id }),
    ).toMatchObject({ active: false });

    const second = await company();
    const healthy = await create(second.session);
    await h.dataSource
      .getRepository(WebhookEndpoint)
      .update(healthy.id, { consecutiveFailures: 7 });
    await h
      .http()
      .post(`/outgoing-webhooks/${healthy.id}/ping`)
      .set(...h.bearer(second.session))
      .expect(202);
    await h.drainTasks();
    expect(
      await h.dataSource
        .getRepository(WebhookEndpoint)
        .findOneByOrFail({ id: healthy.id }),
    ).toMatchObject({ active: true, consecutiveFailures: 0 });
  });

  it('publishes every business event and rolls queued consequences back with the producer', async () => {
    const account = await company('premium');
    await create(account.session, [
      'report.ready',
      'report.failed',
      'rules.failed',
      'quota.threshold',
      'invoice.finalized',
      'file.uploaded',
    ]);

    await h
      .http()
      .post('/quality-rules')
      .set(...h.bearer(account.session))
      .send({ name: 'IDs are unique', kind: 'unique', columnName: 'id' })
      .expect(201);
    await h
      .upload(account.session, {
        content: 'id,value\n1,a\n1,b\n',
      })
      .expect(201);
    await h.drainTasks();

    await h.dataSource.transaction((manager) =>
      h.app.get(QuotaAlertsService).check(manager, {
        companyId: account.companyId,
        plan: 'premium',
        periodKey: '2026-03-01',
        periodEnd: new Date('2026-04-01T00:00:00.000Z'),
        filesUsed: 800,
        filesLimit: 1000,
      }),
    );
    h.clock.advance(86_400_000);
    await h.dataSource.transaction(async (manager) => {
      const subscription = await manager.findOneByOrFail(Subscription, {
        companyId: account.companyId,
      });
      await h.app
        .get(InvoicingService)
        .closePeriod(manager, subscription, h.clock.now());
    });

    const publisher = h.app.get(WebhookPublisher);
    await h.dataSource.transaction((manager) =>
      publisher.publish(manager, account.companyId, 'report.failed', {
        fileId: randomUUID(),
        reportStatus: 'failed',
      }),
    );

    const types = new Set(
      (
        await h.dataSource.getRepository(WebhookDelivery).find({
          where: { companyId: account.companyId },
        })
      ).map((delivery) => delivery.eventType),
    );
    expect(types).toEqual(
      new Set([
        'file.uploaded',
        'report.ready',
        'report.failed',
        'rules.failed',
        'quota.threshold',
        'invoice.finalized',
      ]),
    );

    const beforeDeliveries = await h.dataSource
      .getRepository(WebhookDelivery)
      .count();
    const beforeTasks = await h.dataSource
      .getRepository(BackgroundTask)
      .count();
    await expect(
      h.dataSource.transaction(async (manager) => {
        await publisher.publish(manager, account.companyId, 'file.uploaded', {
          fileId: randomUUID(),
        });
        throw new Error('producer rolled back');
      }),
    ).rejects.toThrow('producer rolled back');
    expect(await h.dataSource.getRepository(WebhookDelivery).count()).toBe(
      beforeDeliveries,
    );
    expect(await h.dataSource.getRepository(BackgroundTask).count()).toBe(
      beforeTasks,
    );
  });
});
