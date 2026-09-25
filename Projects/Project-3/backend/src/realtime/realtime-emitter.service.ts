import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import type { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { DataQualityReport } from '#/files/data-quality-report.entity.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { RealtimeGateway } from './realtime.gateway.js';
import {
  adminRoom,
  type AuditAppendedEvent,
  companyRoom,
  type FileStatusEvent,
  type QuotaUpdatedEvent,
  userRoom,
} from './realtime-events.js';

/**
 * The one way the rest of the app talks to connected sockets.
 *
 * - **Emit only AFTER the change is committed.** A caller never emits from inside a
 *   transaction: the transaction could still roll back, and a client that refetches on the
 *   event could read the old state. (`AuditBroadcaster` does this for audit entries by
 *   listening for the commit itself.)
 * - **Best effort, never fatal.** A realtime failure must not fail an upload or a report
 *   job: every method swallows and logs its own error. Clients that miss an event recover
 *   by reading the REST API, which stays the source of truth.
 * - **The audience is decided at emit time from the database**, so who is told about a
 *   restricted file is who may see it NOW: admins, the uploader and the granted people —
 *   the same rule as the visibility predicate — never the rest of the company.
 */
@Injectable()
export class RealtimeEmitter {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RealtimeEmitter.name);
  }

  /** A file's report status changed (queued → profiling → ready | failed | unsupported). */
  async fileStatus(fileId: string): Promise<void> {
    await this.safely('file.status', async () => {
      const file = await this.dataSource.getRepository(FileAsset).findOne({ where: { id: fileId } });
      const report = await this.dataSource.getRepository(DataQualityReport).findOne({ where: { fileId } });
      if (!file || file.deletedAt || !report) return;

      const event: FileStatusEvent = { fileId, status: report.status, error: report.errorMessage };
      const rooms = await this.audience(file);
      this.gateway.server.to(rooms).emit('file.status', event);
    });
  }

  /** An upload was counted against the company's plan. Everyone in the company sees the meter move. */
  async quotaUpdated(companyId: string, event: QuotaUpdatedEvent): Promise<void> {
    await this.safely('quota.updated', async () => {
      this.gateway.server.to(companyRoom(companyId)).emit('quota.updated', event);
    });
  }

  /** A new audit entry was committed. Admins only: the log records what everyone did. */
  async auditAppended(entry: AuditLogEntry): Promise<void> {
    await this.safely('audit.appended', async () => {
      const event: AuditAppendedEvent = {
        id: entry.id,
        action: entry.action,
        actorUserId: entry.actorUserId,
        targetType: entry.targetType,
        targetId: entry.targetId,
        createdAt: entry.createdAt.toISOString(),
      };
      this.gateway.server.to(adminRoom(entry.companyId)).emit('audit.appended', event);
    });
  }

  /** Drops every socket a person has open (a removed employee must not keep listening). */
  async disconnectUser(userId: string): Promise<void> {
    await this.safely('disconnect', async () => {
      this.gateway.server.in(userRoom(userId)).disconnectSockets(true);
    });
  }

  /** Who may be told about this file — the visibility rule, applied to rooms. */
  private async audience(file: FileAsset): Promise<string[]> {
    if (file.visibility === 'company') return [companyRoom(file.companyId)];

    const grants = await this.dataSource.getRepository(FileAccessGrant).find({ where: { fileId: file.id } });
    return [
      adminRoom(file.companyId),
      userRoom(file.uploaderId),
      ...grants.map((grant) => userRoom(grant.userId)),
    ];
  }

  private async safely(what: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.warn({ err: error, what }, 'Realtime emit failed');
    }
  }
}
