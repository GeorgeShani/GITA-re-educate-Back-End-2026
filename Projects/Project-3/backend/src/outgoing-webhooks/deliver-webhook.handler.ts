import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { WebhookDelivery } from './webhook-delivery.entity.js';
import { WebhookEndpoint } from './webhook-endpoint.entity.js';
import { webhookEnvelopeSchema } from './webhook-events.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import { signWebhook } from './webhook-signature.js';
import {
  WEBHOOK_TRANSPORT,
  type WebhookResponse,
  type WebhookTransport,
} from './webhook-transport.js';

const deliveryPayloadSchema = z.object({ deliveryId: z.uuid() });
type DeliveryPayload = z.infer<typeof deliveryPayloadSchema>;

@Injectable()
export class DeliverWebhookHandler implements TaskHandler<DeliveryPayload> {
  readonly type = 'deliver_webhook' as const;
  readonly schema = deliveryPayloadSchema;

  constructor(
    private readonly dataSource: DataSource,
    private readonly secrets: WebhookSecretService,
    @Inject(WEBHOOK_TRANSPORT) private readonly transport: WebhookTransport,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle({ deliveryId }: DeliveryPayload): Promise<void> {
    const delivery = await this.dataSource
      .getRepository(WebhookDelivery)
      .findOne({
        where: { id: deliveryId },
        relations: { endpoint: true },
      });
    if (!delivery || delivery.status === 'succeeded') return;
    const endpoint = delivery.endpoint;
    if (!endpoint || endpoint.deletedAt || !endpoint.active) {
      await this.dataSource.getRepository(WebhookDelivery).update(delivery.id, {
        status: 'failed',
        lastError: 'Webhook endpoint is disabled.',
      });
      return;
    }

    const envelope = webhookEnvelopeSchema.parse(delivery.envelope);
    const body = JSON.stringify(envelope);
    const timestamp = String(Math.floor(this.clock.now().getTime() / 1_000));
    const signed = signWebhook(this.secrets.decrypt(endpoint), timestamp, body);
    await this.dataSource
      .getRepository(WebhookDelivery)
      .increment({ id: delivery.id }, 'attempts', 1);
    let response: WebhookResponse;
    try {
      response = await this.transport.send({
        url: endpoint.url,
        body,
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Gridline-Webhooks/1.0',
          'webhook-id': envelope.id,
          'webhook-timestamp': signed.timestamp,
          'webhook-signature': signed.signature,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Webhook transport failed.';
      await this.dataSource
        .getRepository(WebhookDelivery)
        .update(delivery.id, { lastError: message });
      throw error;
    }

    if (response.status >= 200 && response.status < 300) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(WebhookDelivery, delivery.id, {
          status: 'succeeded',
          responseStatus: response.status,
          lastError: null,
          deliveredAt: this.clock.now(),
        });
        await manager.update(WebhookEndpoint, endpoint.id, {
          consecutiveFailures: 0,
        });
      });
      return;
    }
    if (response.status === 410) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(WebhookDelivery, delivery.id, {
          status: 'failed',
          responseStatus: 410,
          lastError: 'Receiver returned HTTP 410 Gone.',
        });
        await manager.update(WebhookEndpoint, endpoint.id, {
          active: false,
          disabledAt: this.clock.now(),
        });
      });
      return;
    }
    await this.dataSource.getRepository(WebhookDelivery).update(delivery.id, {
      responseStatus: response.status,
      lastError: `Receiver returned HTTP ${response.status}.`,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Webhook receiver attempted to redirect the request.');
    }
    throw new Error(`Webhook receiver returned HTTP ${response.status}.`);
  }

  async onDead({ deliveryId }: DeliveryPayload, error: unknown): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const delivery = await manager.findOne(WebhookDelivery, {
        where: { id: deliveryId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!delivery || delivery.status !== 'pending') return;
      const endpoint = await manager.findOne(WebhookEndpoint, {
        where: { id: delivery.endpointId },
        lock: { mode: 'pessimistic_write' },
      });
      const reason =
        error instanceof Error ? error.message : 'Webhook delivery failed.';
      await manager.update(WebhookDelivery, delivery.id, {
        status: 'failed',
        lastError: reason,
      });
      if (!endpoint || endpoint.deletedAt) return;
      const failures = endpoint.consecutiveFailures + 1;
      await manager.update(WebhookEndpoint, endpoint.id, {
        consecutiveFailures: failures,
        ...(failures >= 20
          ? { active: false, disabledAt: this.clock.now() }
          : {}),
      });
    });
  }
}
