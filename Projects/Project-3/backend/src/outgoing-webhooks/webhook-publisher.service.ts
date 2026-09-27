import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { WebhookDelivery } from './webhook-delivery.entity.js';
import { WebhookEndpoint } from './webhook-endpoint.entity.js';
import type {
  OutgoingWebhookEvent,
  WebhookEnvelope,
} from './webhook-events.js';

@Injectable()
export class WebhookPublisher {
  constructor(
    private readonly queue: TaskQueue,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async publish(
    manager: EntityManager,
    companyId: string,
    type: Exclude<OutgoingWebhookEvent, 'ping'>,
    data: Record<string, unknown>,
  ): Promise<WebhookDelivery[]> {
    const endpoints = await manager
      .getRepository(WebhookEndpoint)
      .createQueryBuilder('endpoint')
      .where('endpoint.companyId = :companyId', { companyId })
      .andWhere('endpoint.active = true AND endpoint.deletedAt IS NULL')
      .andWhere(':type = ANY(endpoint.events)', { type })
      .orderBy('endpoint.id', 'ASC')
      .getMany();
    if (endpoints.length === 0) return [];

    const envelope = this.envelope(companyId, type, data);
    const deliveries = await manager.save(
      WebhookDelivery,
      endpoints.map((endpoint) =>
        manager.create(WebhookDelivery, {
          companyId,
          endpointId: endpoint.id,
          eventId: envelope.id,
          eventType: type,
          envelope,
          status: 'pending',
          attempts: 0,
          responseStatus: null,
          lastError: null,
          deliveredAt: null,
        }),
      ),
    );
    for (const delivery of deliveries) {
      await this.queue.enqueue(
        'deliver_webhook',
        { deliveryId: delivery.id },
        { manager },
      );
    }
    return deliveries;
  }

  async ping(
    manager: EntityManager,
    endpoint: WebhookEndpoint,
  ): Promise<WebhookDelivery> {
    const envelope = this.envelope(endpoint.companyId, 'ping', {
      endpointId: endpoint.id,
    });
    const delivery = await manager.save(
      manager.create(WebhookDelivery, {
        companyId: endpoint.companyId,
        endpointId: endpoint.id,
        eventId: envelope.id,
        eventType: 'ping',
        envelope,
        status: 'pending',
        attempts: 0,
        responseStatus: null,
        lastError: null,
        deliveredAt: null,
      }),
    );
    await this.queue.enqueue(
      'deliver_webhook',
      { deliveryId: delivery.id },
      { manager },
    );
    return delivery;
  }

  private envelope(
    companyId: string,
    type: OutgoingWebhookEvent,
    data: Record<string, unknown>,
  ): WebhookEnvelope {
    return {
      id: randomUUID(),
      type,
      createdAt: this.clock.now().toISOString(),
      companyId,
      schemaVersion: 1,
      data,
    };
  }
}
