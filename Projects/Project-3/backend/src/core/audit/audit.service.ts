import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { RequestContextService } from '../context/request-context.service.js';
import { AuditLogEntry } from './audit-log-entry.entity.js';

export interface AuditRecordInput {
  /** Dotted, past-tense, e.g. `user.invited`. */
  action: string;
  target?: { type: string; id: string };
  metadata?: Record<string, unknown>;
  /**
   * Overrides the context's tenant/actor. Needed by flows with no
   * authenticated request behind them — company registration, activation,
   * token-driven flows, the task runner — where the context is empty.
   */
  companyId?: string;
  actorUserId?: string | null;
}

/**
 * The only writer of `audit_log_entry`. There is deliberately no update or
 * delete method — the table's trigger enforces the same thing in the database.
 *
 * Pass the caller's `EntityManager` so the entry commits or rolls back with
 * the state change it describes.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntry) private readonly repository: Repository<AuditLogEntry>,
    private readonly context: RequestContextService,
  ) {}

  async record(input: AuditRecordInput, manager?: EntityManager): Promise<AuditLogEntry> {
    const repository = manager ? manager.getRepository(AuditLogEntry) : this.repository;

    return repository.save(
      repository.create({
        companyId: input.companyId ?? this.context.requireCompanyId(),
        actorUserId:
          input.actorUserId !== undefined ? input.actorUserId : (this.context.userId ?? null),
        action: input.action,
        targetType: input.target?.type ?? null,
        targetId: input.target?.id ?? null,
        metadata: input.metadata ?? {},
        ip: this.context.ip ?? null,
        correlationId: this.context.correlationId ?? null,
      }),
    );
  }
}
