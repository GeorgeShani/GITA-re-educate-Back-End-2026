import { Global, Module } from '@nestjs/common';
import { IdempotencyJanitor } from './idempotency-janitor.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

/**
 * Global so any controller can `@UseInterceptors(IdempotencyInterceptor)` without importing this.
 * Also owns the hourly janitor that deletes records nobody can use any more.
 */
@Global()
@Module({
  providers: [IdempotencyInterceptor, IdempotencyJanitor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
