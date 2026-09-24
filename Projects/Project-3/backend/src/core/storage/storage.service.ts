import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { STORAGE_DRIVER, type StorageDriver } from './storage-driver.js';

/** Downloads are minted per request and short-lived: access is checked, then the link expires. */
export const PRESIGN_TTL_SECONDS = 5 * 60;

export interface DownloadLink {
  url: string;
  expiresAt: Date;
}

/** The app-facing side of storage; the driver behind it is the seam (S3, local, or a test double). */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.driver.put(key, body, contentType);
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  async downloadLink(key: string, downloadName: string): Promise<DownloadLink> {
    const expiresAt = new Date(this.clock.now().getTime() + PRESIGN_TTL_SECONDS * 1000);
    const url = await this.driver.presignedGetUrl(key, {
      expiresInSeconds: PRESIGN_TTL_SECONDS,
      downloadName,
    });
    return { url, expiresAt };
  }
}
