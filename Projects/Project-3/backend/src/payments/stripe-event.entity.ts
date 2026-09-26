import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';

@Entity({ name: 'stripe_event' })
export class StripeEvent extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'text' })
  stripeEventId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'timestamptz' })
  stripeCreatedAt!: Date;

  @Column({ type: 'boolean' })
  livemode!: boolean;

  @Column({ type: 'timestamptz' })
  processedAt!: Date;
}
