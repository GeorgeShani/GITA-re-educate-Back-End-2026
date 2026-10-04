import type { EntityManager } from 'typeorm';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { WebhookPublisher } from '#/outgoing-webhooks/webhook-publisher.service.js';
import { DataQualityReport } from '../data-quality-report.entity.js';
import type { FileAsset } from '../file-asset.entity.js';
import { metricsSchema } from './metrics.js';

export interface SensitiveColumn {
  name: string;
  kind: string;
}

type AnnouncedFile = Pick<FileAsset, 'id' | 'companyId' | 'originalName' | 'uploaderId' | 'visibility'>;

/** The columns of a file's finished report that look like personal or secret data (none while it is not ready). */
export async function sensitiveColumnsOf(manager: EntityManager, file: Pick<FileAsset, 'id' | 'companyId'>): Promise<SensitiveColumn[]> {
  const report = await manager.findOne(DataQualityReport, { where: { fileId: file.id, companyId: file.companyId } });
  const parsed = report?.status === 'ready' && report.metrics ? metricsSchema.safeParse(report.metrics) : null;
  if (!parsed?.success) return [];
  return parsed.data.columns.flatMap((column) => (column.sensitive ? [{ name: column.name, kind: column.sensitive.kind }] : []));
}

/**
 * Says that a file looks like it holds personal or secret data. Everyone listening is told by webhook, because a receiver may
 * want to act on it; the PEOPLE are told only when the file is open to the whole company, since that is the one case where
 * someone has a decision to make (restricting it). Called when a report finishes, and again when a file with such a report is
 * opened up to the whole company.
 */
export async function announceSensitiveData(
  deps: { notifications: NotificationsService; webhooks: WebhookPublisher },
  manager: EntityManager,
  file: AnnouncedFile,
  columns: readonly SensitiveColumn[],
): Promise<void> {
  if (columns.length === 0) return;
  await deps.webhooks.publish(manager, file.companyId, 'file.sensitive_data_found', {
    fileId: file.id,
    columnCount: columns.length,
    kinds: [...new Set(columns.map((column) => column.kind))],
    visibility: file.visibility,
  });
  if (file.visibility !== 'company') return;
  const admins = await deps.notifications.activeAdminIds(manager, file.companyId);
  await deps.notifications.notify(manager, file.companyId, [...new Set([file.uploaderId, ...admins])], {
    type: 'file.sensitive_data',
    payload: { fileId: file.id, fileName: file.originalName, columns: columns.slice(0, 20), visibility: file.visibility },
  });
}
