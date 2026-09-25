import { Global, Module } from '@nestjs/common';
import { BusinessMetrics } from './business-metrics.js';
import { ObserveTelemetrySink, TELEMETRY_SINK } from './telemetry-sink.js';

/** Global: the auth guard, files, subscriptions and invoicing all report through `BusinessMetrics`. */
@Global()
@Module({
  providers: [{ provide: TELEMETRY_SINK, useClass: ObserveTelemetrySink }, BusinessMetrics],
  exports: [TELEMETRY_SINK, BusinessMetrics],
})
export class TelemetryModule {}
