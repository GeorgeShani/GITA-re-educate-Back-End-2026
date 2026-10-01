import { Global, Module } from '@nestjs/common';
import { IdempotencyJanitor } from './idempotency-janitor.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { IdempotencyStore } from './idempotency-store.js';

/**
 * Global so any controller can `@UseInterceptors(IdempotencyInterceptor)` (or inject the store) without importing this.
 * Also owns the hourly janitor that deletes records nobody can use any more.
 */
@Global()
@Module({
  providers: [IdempotencyStore, IdempotencyInterceptor, IdempotencyJanitor],
  exports: [IdempotencyInterceptor, IdempotencyStore],
})
export class IdempotencyModule {}
