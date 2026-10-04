import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, In } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { StorageService } from '#/core/storage/storage.service.js';
import { FileAsset } from './file-asset.entity.js';

/** An object younger than this is left alone: its row may still be on its way to being committed. */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

const BATCH = 500;

/**
 * Deletes stored objects that no file row points to. An upload stores the bytes before it commits the row, so a crash
 * between the two leaves bytes nobody can reach and nobody pays for in the quota. This finds them. A soft-deleted file
 * still has its row (and its bytes), so it is never mistaken for an orphan.
 */
@Injectable()
export class OrphanedObjectsJanitor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(OrphanedObjectsJanitor.name);
  }

  /** Removes the orphans older than a day before `now`. Returns how many. Safe to run twice. */
  async purge(now: Date = this.clock.now()): Promise<number> {
    const cutoff = now.getTime() - ORPHAN_GRACE_MS;
    let removed = 0;
    let batch: string[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      const rows = await this.dataSource.getRepository(FileAsset).find({ where: { storageKey: In(batch) }, select: { storageKey: true } });
      const known = new Set(rows.map((row) => row.storageKey));
      for (const key of batch) {
        if (known.has(key)) continue;
        await this.storage.delete(key);
        removed += 1;
      }
      batch = [];
    };
    for await (const object of this.storage.list('companies/')) {
      if (object.modifiedAt.getTime() >= cutoff) continue;
      batch.push(object.key);
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    return removed;
  }

  /** Daily. A no-op under test (specs call `purge`) and while generating docs. */
  @Cron('27 4 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    try {
      const removed = await this.purge();
      if (removed > 0) this.logger.info({ removed }, 'Removed stored files that no record points to');
    } catch (error) {
      this.logger.error({ err: error }, 'Orphan sweep failed');
    }
  }
}
