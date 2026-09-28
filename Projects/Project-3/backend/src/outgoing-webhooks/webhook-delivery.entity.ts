import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import type { WebhookEnvelope } from './webhook-events.js';
import { WebhookEndpoint } from './webhook-endpoint.entity.js';

export const WEBHOOK_DELIVERY_STATUSES = [
  'pending',
  'succeeded',
  'failed',
] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

@Entity({ name: 'webhook_delivery' })
@Index('uq_webhook_delivery_endpoint_event', ['endpointId', 'eventId'], {
  unique: true,
})
@Index('idx_webhook_delivery_company_endpoint_created', [
  'companyId',
  'endpointId',
  'createdAt',
])
@Index('idx_webhook_delivery_created_at', ['createdAt'])
export class WebhookDelivery extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => WebhookEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpointId' })
  endpoint?: Relation<WebhookEndpoint>;

  @Column({ type: 'uuid' })
  endpointId!: string;

  @Column({ type: 'uuid' })
  eventId!: string;

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  envelope!: WebhookEnvelope;

  @Column({ type: 'text', default: 'pending' })
  status!: WebhookDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;
}
