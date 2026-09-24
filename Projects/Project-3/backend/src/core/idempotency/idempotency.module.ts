import { Global, Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

/** Global so any controller can `@UseInterceptors(IdempotencyInterceptor)` without importing this. */
@Global()
@Module({
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
