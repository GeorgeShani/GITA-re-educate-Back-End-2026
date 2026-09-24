import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, type EntityManager, In } from 'typeorm';
import { InvoicingService } from '#/billing/invoicing.service.js';
import { periodKey } from '#/billing/period.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { UsageService } from '#/billing/usage.service.js';
import { decodeCursor } from '#/common/pagination/cursor.js';
import { applyCursor, toCursorPage } from '#/common/pagination/paginate.js';
import type { CursorPage } from '#/common/pagination/paginated-result.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { type DownloadLink, StorageService } from '#/core/storage/storage.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';
import type { FilesQueryDto } from './dto/files-query.dto.js';
import type { UpdateFileDto } from './dto/update-file.dto.js';
import type { UploadFileDto } from './dto/upload-file.dto.js';
import { FileAccessGrant } from './file-access-grant.entity.js';
import { FileAsset, type FileVisibility } from './file-asset.entity.js';
import { type FileViewer, applyFileVisibility } from './file-visibility.js';
import { blockedMessage, overageWarning, quotaDecision } from './quota.js';
import { sniffSpreadsheet } from './validation/sniff-spreadsheet.js';

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.';
const NOT_FOUND = 'File not found';
const MAX_NAME_LENGTH = 255;

export interface UploadResult {
  file: FileAsset;
  grantedUserIds: string[];
  /** Set for a Premium upload past the included quota; sent as `X-Gridline-Quota-Warning`. */
  quotaWarning: string | null;
}

export interface FileWithGrants {
  file: FileAsset;
  /** Present only for someone who may manage the file; everyone else learns nothing about who else has access. */
  grantedUserIds: string[] | null;
}

/** The columns a list needs. `storageKey` is deliberately absent: it is never selected, let alone returned. */
const LIST_COLUMNS = [
  'f.id',
  'f.companyId',
  'f.uploaderId',
  'f.originalName',
  'f.mimeType',
  'f.sizeBytes',
  'f.visibility',
  'f.deletedAt',
  'f.createdAt',
  'f.updatedAt',
];

/**
 * Multer (busboy) reads the `filename` parameter as Latin-1, but browsers and curl
 * send it as UTF-8 bytes, so `ანგარიში.csv` arrives as `áááá…`. Re-reading those
 * bytes as UTF-8 undoes it. A name that is not valid UTF-8 when re-read (it really was
 * Latin-1) is left exactly as received.
 */
export function decodeMultipartName(raw: string): string {
  const repaired = Buffer.from(raw, 'latin1').toString('utf8');
  return repaired.includes('�') ? raw : repaired;
}

/**
 * A client-supplied name, reduced to something safe to store and show: no directory
 * parts (`..\..\evil.csv` → `evil.csv`), no control characters, bounded length. It is
 * display-only — storage keys are generated, so the name is never a path.
 */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'upload').slice(0, MAX_NAME_LENGTH);
}

@Injectable()
export class FilesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly subscriptions: SubscriptionsService,
    private readonly invoicing: InvoicingService,
    private readonly usage: UsageService,
    private readonly storage: StorageService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    private readonly context: RequestContextService,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.logger.setContext(FilesService.name);
  }

  /**
   * The upload, in the order that keeps every failure clean:
   *
   * 1. Validate (the magic-byte pipe has already run) and check the grantees.
   * 2. Pre-check the quota WITHOUT a lock — a Free/Basic company over its cap is told
   *    so before anything is stored. Skipped if the period has already ended (the
   *    stored count is then stale; the transaction rolls the period forward and decides).
   * 3. Store the object.
   * 4. One transaction, holding the subscription row lock: re-check the quota (this is
   *    the real decision — two concurrent uploads at the last slot serialise here),
   *    then write the file, its grants, ONE usage event, the report task and the audit
   *    entry together.
   *
   * Anything that fails after step 3 deletes the stored object, so nothing leaks and
   * no quota is consumed. A rejected type, a failed check or a storage error never
   * reaches step 4's usage event.
   */
  async upload(file: Express.Multer.File, dto: UploadFileDto): Promise<UploadResult> {
    const { companyId, viewer } = this.caller();

    const mimeType = await sniffSpreadsheet(file.buffer);
    if (!mimeType) {
      // The pipe normally stops this first; a service must not trust its caller to.
      throw new BadRequestException('Only CSV, XLS and XLSX spreadsheets are accepted.');
    }

    const grants = this.grantsFor(dto.visibility, dto.grantedUserIds, viewer.userId);
    await this.assertActiveMembers(this.dataSource.manager, companyId, grants);
    await this.precheckQuota(companyId);

    const fileId = randomUUID();
    const storageKey = `companies/${companyId}/files/${fileId}`;
    await this.storage.put(storageKey, file.buffer, mimeType);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const subscription = await this.subscriptions.lockForUpdate(manager, companyId);
        if (!subscription) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);

        const now = this.clock.now();
        // Bring the period up to date first, or the count below is for a period that has ended.
        await this.invoicing.rollForward(manager, subscription, now);
        const key = periodKey({
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd,
        });

        const decision = quotaDecision(
          subscription.plan,
          await this.usage.filesInPeriod(manager, companyId, key),
          subscription.currentPeriodEnd,
        );
        if (decision.kind === 'blocked') {
          throw new HttpException(blockedMessage(decision), HttpStatus.PAYMENT_REQUIRED);
        }

        await this.assertActiveMembers(manager, companyId, grants);

        const saved = await manager.save(
          manager.create(FileAsset, {
            id: fileId,
            companyId,
            uploaderId: viewer.userId,
            originalName: sanitizeFileName(decodeMultipartName(file.originalname)),
            mimeType,
            sizeBytes: file.size,
            storageKey,
            visibility: dto.visibility,
            deletedAt: null,
          }),
        );
        if (grants.length > 0) {
          await manager.insert(
            FileAccessGrant,
            grants.map((userId) => ({ fileId, userId })),
          );
        }
        await manager.insert(UsageEvent, { companyId, fileId, periodKey: key });
        await this.queue.enqueue(
          'build_data_quality_report',
          { fileId, companyId },
          { manager },
        );
        await this.audit.record(
          {
            action: 'file.uploaded',
            target: { type: 'file', id: fileId },
            metadata: {
              originalName: saved.originalName,
              mimeType,
              sizeBytes: saved.sizeBytes,
              visibility: dto.visibility,
              grantCount: grants.length,
              overage: decision.kind === 'overage',
            },
          },
          manager,
        );

        return {
          file: saved,
          grantedUserIds: grants,
          quotaWarning: decision.kind === 'overage' ? overageWarning(decision) : null,
        };
      });
    } catch (error) {
      await this.discardObject(storageKey);
      throw error;
    }
  }

  /** Newest first by default, keyset-paginated; the visibility predicate always applies first. */
  async list(query: FilesQueryDto): Promise<CursorPage<FileAsset>> {
    const { viewer } = this.caller();
    const qb = this.visibleFiles(this.dataSource.manager, 'f', viewer).select(LIST_COLUMNS);

    if (query.mimeType) qb.andWhere('f.mimeType = :mimeType', { mimeType: query.mimeType });
    if (query.visibility) qb.andWhere('f.visibility = :visibility', { visibility: query.visibility });
    if (query.uploaderId) qb.andWhere('f.uploaderId = :uploaderId', { uploaderId: query.uploaderId });
    if (query.uploadedAfter) qb.andWhere('f.createdAt >= :after', { after: query.uploadedAfter });
    if (query.uploadedBefore) qb.andWhere('f.createdAt < :before', { before: query.uploadedBefore });

    applyCursor(
      qb,
      'f',
      query.cursor ? decodeCursor(query.cursor) : undefined,
      query.sort.startsWith('-') ? 'DESC' : 'ASC',
    );
    return toCursorPage(qb, query.limit);
  }

  async get(id: string): Promise<FileWithGrants> {
    const { viewer } = this.caller();
    const file = await this.findVisible(this.dataSource.manager, id, viewer);
    return { file, grantedUserIds: await this.grantsIfManager(this.dataSource.manager, file, viewer) };
  }

  /** A short-lived link, minted only after the caller's access has been checked. */
  async downloadLink(id: string): Promise<DownloadLink> {
    const { viewer } = this.caller();
    const file = await this.findVisible(this.dataSource.manager, id, viewer);
    return this.storage.downloadLink(file.storageKey, file.originalName);
  }

  /**
   * Changes who can see a file. Uploader or admin only: someone who can see the file
   * but does not own it gets 403 (they already know it exists); someone who cannot
   * see it gets 404. `grantedUserIds` REPLACES the grant set.
   */
  async update(id: string, dto: UpdateFileDto): Promise<FileWithGrants> {
    const { companyId, viewer } = this.caller();
    if (dto.visibility === undefined && dto.grantedUserIds === undefined) {
      throw new BadRequestException('Provide `visibility` and/or `grantedUserIds`.');
    }

    return this.dataSource.transaction(async (manager) => {
      // Locked, so two edits of one file's grants cannot interleave their delete-then-insert.
      const file = await this.findVisible(manager, id, viewer, true);
      this.assertCanManage(file, viewer);

      const next: FileVisibility = dto.visibility ?? file.visibility;
      if (next === 'company' && dto.grantedUserIds !== undefined && dto.grantedUserIds.length > 0) {
        throw new BadRequestException('`grantedUserIds` only applies to a restricted file.');
      }
      if (dto.visibility === undefined && dto.grantedUserIds !== undefined && file.visibility === 'company') {
        throw new BadRequestException(
          'This file is visible to the whole company. Set `visibility` to `restricted` to choose who can see it.',
        );
      }

      const current = await this.grantIds(manager, file.id);
      // `null` = leave the grants alone.
      const desired: string[] | null =
        next === 'company'
          ? []
          : dto.grantedUserIds !== undefined
            ? this.grantsFor(next, dto.grantedUserIds, file.uploaderId)
            : null;

      if (desired) await this.assertActiveMembers(manager, companyId, desired);

      const added = desired ? desired.filter((userId) => !current.includes(userId)) : [];
      const removed = desired ? current.filter((userId) => !desired.includes(userId)) : [];
      if (removed.length > 0) {
        await manager.delete(FileAccessGrant, { fileId: file.id, userId: In(removed) });
      }
      if (added.length > 0) {
        await manager.insert(FileAccessGrant, added.map((userId) => ({ fileId: file.id, userId })));
      }
      if (next !== file.visibility) {
        await manager.update(FileAsset, { id: file.id }, { visibility: next });
      }

      await this.audit.record(
        {
          action: 'file.access_changed',
          target: { type: 'file', id: file.id },
          metadata: {
            visibilityFrom: file.visibility,
            visibilityTo: next,
            grantsAdded: added.length,
            grantsRemoved: removed.length,
          },
        },
        manager,
      );

      const fresh = await manager.findOneOrFail(FileAsset, { where: { id: file.id } });
      return { file: fresh, grantedUserIds: await this.grantIds(manager, file.id) };
    });
  }

  /**
   * Soft delete: the row and its history stay (`deletedAt`), the stored object goes.
   * The usage event stays too — the upload counted when it happened, so deleting a
   * file does not refund quota.
   */
  async remove(id: string): Promise<void> {
    const { viewer } = this.caller();

    const storageKey = await this.dataSource.transaction(async (manager) => {
      const file = await this.findVisible(manager, id, viewer, true);
      this.assertCanManage(file, viewer);

      await manager.update(FileAsset, { id: file.id }, { deletedAt: this.clock.now() });
      await this.audit.record(
        {
          action: 'file.deleted',
          target: { type: 'file', id: file.id },
          metadata: { originalName: file.originalName },
        },
        manager,
      );
      return file.storageKey;
    });

    // After the commit: if this fails the file is already gone from every listing and
    // only an unreachable object is left, which is far better than the reverse.
    await this.discardObject(storageKey);
  }

  // ---- internals ----------------------------------------------------------

  private caller(): { companyId: string; viewer: FileViewer } {
    const companyId = this.context.requireCompanyId();
    const { userId, role } = this.context;
    if (!userId || !role) throw new UnauthorizedException();
    return { companyId, viewer: { userId, role } };
  }

  /** The company's live files this viewer may see: TenantScope first, then the one visibility rule. */
  private visibleFiles(manager: EntityManager, alias: string, viewer: FileViewer) {
    const companyId = this.context.requireCompanyId();
    return applyFileVisibility(
      this.tenantScope.forCompany(manager.getRepository(FileAsset), companyId, alias),
      alias,
      viewer,
    );
  }

  /** A file the viewer cannot see is a 404 — never a 403 — so its existence is not disclosed. */
  private async findVisible(
    manager: EntityManager,
    id: string,
    viewer: FileViewer,
    lock = false,
  ): Promise<FileAsset> {
    const qb = this.visibleFiles(manager, 'f', viewer).andWhere('f.id = :id', { id });
    if (lock) qb.setLock('pessimistic_write');
    const file = await qb.getOne();
    if (!file) throw new NotFoundException(NOT_FOUND);
    return file;
  }

  private assertCanManage(file: FileAsset, viewer: FileViewer): void {
    if (viewer.role !== 'admin' && file.uploaderId !== viewer.userId) {
      throw new ForbiddenException('Only the uploader or an admin can change or delete this file.');
    }
  }

  private async grantsIfManager(
    manager: EntityManager,
    file: FileAsset,
    viewer: FileViewer,
  ): Promise<string[] | null> {
    return viewer.role === 'admin' || file.uploaderId === viewer.userId
      ? this.grantIds(manager, file.id)
      : null;
  }

  private async grantIds(manager: EntityManager, fileId: string): Promise<string[]> {
    const rows = await manager.find(FileAccessGrant, { where: { fileId }, order: { createdAt: 'ASC', id: 'ASC' } });
    return rows.map((row) => row.userId);
  }

  /**
   * The grant list for a visibility. A `company` file has none (and asking for some is
   * a contradiction); the uploader is dropped, since they always see their own file.
   */
  private grantsFor(
    visibility: FileVisibility,
    requested: string[] | undefined,
    uploaderId: string,
  ): string[] {
    if (visibility === 'company') {
      if (requested && requested.length > 0) {
        throw new BadRequestException('`grantedUserIds` only applies to a restricted file.');
      }
      return [];
    }
    return [...new Set(requested ?? [])].filter((userId) => userId !== uploaderId);
  }

  /** Grantees must be active members of THIS company. One message for "unknown" and "someone else's". */
  private async assertActiveMembers(
    manager: EntityManager,
    companyId: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;

    const found = await this.tenantScope
      .forCompany(manager.getRepository(User), companyId, 'u')
      .andWhere('u.id IN (:...userIds)', { userIds })
      .andWhere("u.status = 'active'")
      .select('u.id')
      .getMany();
    const known = new Set(found.map((user) => user.id));
    const missing = userIds.filter((userId) => !known.has(userId));
    if (missing.length > 0) {
      throw new BadRequestException(
        `grantedUserIds must be active members of your company. Not found: ${missing.join(', ')}`,
      );
    }
  }

  private async precheckQuota(companyId: string): Promise<void> {
    const subscription = await this.tenantScope
      .forCompany(this.dataSource.getRepository(Subscription), companyId, 'sub')
      .getOne();
    if (!subscription) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);
    // A period that has ended has a stale count; the transaction rolls forward and decides.
    if (this.clock.now().getTime() >= subscription.currentPeriodEnd.getTime()) return;

    const decision = quotaDecision(
      subscription.plan,
      await this.usage.filesInPeriod(
        this.dataSource.manager,
        companyId,
        periodKey({ start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd }),
      ),
      subscription.currentPeriodEnd,
    );
    if (decision.kind === 'blocked') {
      throw new HttpException(blockedMessage(decision), HttpStatus.PAYMENT_REQUIRED);
    }
  }

  private async discardObject(storageKey: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      this.logger.error({ err: error, storageKey }, 'Failed to delete a stored object; it is now orphaned');
    }
  }
}
