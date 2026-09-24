import { createHmac } from 'node:crypto';
import { Global, Module } from '@nestjs/common';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { LocalDownloadController } from './local-download.controller.js';
import { LocalStorageDriver } from './local-storage.driver.js';
import { S3StorageDriver } from './s3-storage.driver.js';
import { STORAGE_DRIVER, type StorageDriver } from './storage-driver.js';
import { StorageService } from './storage.service.js';
import { UnconfiguredStorageDriver } from './unconfigured-storage.driver.js';

const DEFAULT_LOCAL_PATH = './.local-storage';

function buildDriver(config: AppConfig, clock: Clock): StorageDriver {
  if (config.STORAGE_DRIVER === 'local') {
    return new LocalStorageDriver({
      root: config.STORAGE_LOCAL_PATH ?? DEFAULT_LOCAL_PATH,
      // The bare API origin: `local` is for running the API directly, without the proxy.
      baseUrl: `http://localhost:${config.PORT}`,
      secret: createHmac('sha256', config.JWT_ACCESS_SECRET).update('gridline:local-storage').digest(),
      clock,
    });
  }

  const { AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = config;
  if (AWS_REGION && AWS_S3_BUCKET && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    return new S3StorageDriver({
      region: AWS_REGION,
      bucket: AWS_S3_BUCKET,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });
  }

  const missing = (
    [
      ['AWS_REGION', AWS_REGION],
      ['AWS_S3_BUCKET', AWS_S3_BUCKET],
      ['AWS_ACCESS_KEY_ID', AWS_ACCESS_KEY_ID],
      ['AWS_SECRET_ACCESS_KEY', AWS_SECRET_ACCESS_KEY],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
  return new UnconfiguredStorageDriver(missing);
}

@Global()
@Module({
  controllers: [LocalDownloadController],
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [APP_CONFIG, CLOCK],
      useFactory: buildDriver,
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_DRIVER],
})
export class StorageModule {}
