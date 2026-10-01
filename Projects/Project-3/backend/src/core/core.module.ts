import { Global, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { CLOCK, SystemClock } from './clock/clock.js';
import { RequestContextService } from './context/request-context.service.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { LoggingModule } from './logging.module.js';
import { TelemetryModule } from './telemetry/telemetry.module.js';
import { VALIDATION_PIPE_OPTIONS } from './validation-pipe-options.js';

/**
 * Cross-cutting infrastructure every module gets for free.
 *
 * The pipe and filter are registered as providers rather than through
 * `app.useGlobalPipes()` / `app.useGlobalFilters()` in `main.ts`, because the
 * filter needs the pino logger and the request context injected. Project-2 wired
 * both in `main.ts` and its filter had to construct a bare `Logger` as a result.
 */
@Global()
@Module({
  // Telemetry lives here, not in AppModule, because billing (invoicing) reports through it and the
  // standalone jobs (billing cycle, seeds) boot `CoreModule` without the rest of the app.
  imports: [LoggingModule, TelemetryModule],
  providers: [
    RequestContextService,
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe(VALIDATION_PIPE_OPTIONS),
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [LoggingModule, RequestContextService, CLOCK],
})
export class CoreModule {}
