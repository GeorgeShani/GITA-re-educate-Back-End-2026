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
import { User } from '#/database/entities/user.entity.js';
import type { SubscribableWebhookEvent } from './webhook-events.js';

@Entity({ name: 'webhook_endpoint' })
@Index('idx_webhook_endpoint_company_created', ['companyId', 'createdAt'])
export class WebhookEndpoint extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy?: Relation<User>;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', array: true })
  events!: SubscribableWebhookEvent[];

  @Column({ type: 'text' })
  encryptedSecret!: string;

  @Column({ type: 'text' })
  secretIv!: string;

  @Column({ type: 'text' })
  secretTag!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'int', default: 0 })
  consecutiveFailures!: number;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
