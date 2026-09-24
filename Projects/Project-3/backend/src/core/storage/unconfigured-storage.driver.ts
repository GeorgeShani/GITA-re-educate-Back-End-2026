import { ServiceUnavailableException } from '@nestjs/common';
import type { StorageDriver } from './storage-driver.js';

/**
 * What `STORAGE_DRIVER=s3` becomes when the AWS variables are missing. The app
 * still boots — nothing but files needs storage, and requiring every third-party
 * account up front would mean nobody can run it (see `env.schema.ts`, "Tier 2") —
 * but the first use says exactly what to set.
 */
export class UnconfiguredStorageDriver implements StorageDriver {
  constructor(private readonly missing: string[]) {}

  put(): Promise<void> {
    return this.fail();
  }

  get(): Promise<Buffer> {
    return this.fail();
  }

  delete(): Promise<void> {
    return this.fail();
  }

  presignedGetUrl(): Promise<string> {
    return this.fail();
  }

  private fail(): never {
    throw new ServiceUnavailableException(
      `File storage is not configured: STORAGE_DRIVER=s3 needs ${this.missing.join(', ')}. Set them, or use STORAGE_DRIVER=local for offline development.`,
    );
  }
}
