import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness } from '#test/support/app-harness.js';
import { WebhookDeliveriesJanitor, WEBHOOK_DELIVERY_RETENTION_MS } from './webhook-deliveries-janitor.service.js';
import { WebhookDelivery } from './webhook-delivery.entity.js';
import { WebhookEndpoint } from './webhook-endpoint.entity.js';

describe('webhook delivery retention (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  it('purges only deliveries older than 30 days and leaves endpoints intact', async () => {
    const account = await h.registerAndActivate();
    const endpoint = await h.dataSource.getRepository(WebhookEndpoint).save({
      companyId: account.companyId,
      createdByUserId: account.userId,
      name: 'retention target',
      url: 'https://hooks.example.test/gridline',
      events: ['file.uploaded'],
      encryptedSecret: 'ciphertext',
      secretIv: 'iv',
      secretTag: 'tag',
      active: true,
      consecutiveFailures: 0,
      disabledAt: null,
      deletedAt: null,
    });
    const deliveries = await h.dataSource.getRepository(WebhookDelivery).save([
      delivery(endpoint, account.companyId),
      delivery(endpoint, account.companyId),
    ]);
    const now = new Date('2026-06-01T00:00:00.000Z');
    const expiredAt = new Date(now.getTime() - WEBHOOK_DELIVERY_RETENTION_MS - 1);
    const retainedAt = new Date(now.getTime() - WEBHOOK_DELIVERY_RETENTION_MS + 1);
    await h.dataSource.getRepository(WebhookDelivery).update(deliveries[0].id, {
      createdAt: expiredAt,
    });
    await h.dataSource.getRepository(WebhookDelivery).update(deliveries[1].id, {
      createdAt: retainedAt,
    });

    const janitor = h.app.get(WebhookDeliveriesJanitor);
    expect(await janitor.purge(now)).toBe(1);
    expect(await janitor.purge(now)).toBe(0);
    expect(await h.dataSource.getRepository(WebhookDelivery).count()).toBe(1);
    expect(
      await h.dataSource
        .getRepository(WebhookEndpoint)
        .countBy({ id: endpoint.id }),
    ).toBe(1);
  });
});

function delivery(
  endpoint: WebhookEndpoint,
  companyId: string,
): Partial<WebhookDelivery> {
  const eventId = randomUUID();
  return {
    companyId,
    endpointId: endpoint.id,
    eventId,
    eventType: 'file.uploaded',
    envelope: {
      id: eventId,
      type: 'file.uploaded',
      createdAt: '2026-03-01T12:00:00.000Z',
      companyId,
      schemaVersion: 1,
      data: { fileId: randomUUID() },
    },
    status: 'succeeded',
    attempts: 1,
    responseStatus: 200,
    lastError: null,
    deliveredAt: new Date('2026-03-01T12:00:01.000Z'),
  };
}
