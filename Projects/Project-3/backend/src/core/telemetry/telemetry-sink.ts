import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TracerService } from '@nestjs/observe';

/**
 * The only thing the app knows about Observe: two verbs. Everything above (`BusinessMetrics`, the auth
 * guard) talks to this, so telemetry is a seam like storage, mail and AI: tests replace it with a
 * recorder, and when Observe is not registered it is a silent no-op.
 */
export interface TelemetrySink {
  /** Tags the CURRENT request's span (e.g. `companyId`), so a trace can be filtered by tenant. */
  tag(key: string, value: string | number | boolean): void;
  /** Adds one to a named counter under the given labels. */
  count(name: string, labels: Record<string, string>): void;
}

export const TELEMETRY_SINK = Symbol('TELEMETRY_SINK');

/**
 * Backed by Observe's `TracerService` — when the module is registered at all (`AppModule` registers it
 * only with both credentials; see `observeImports`). It looks the tracer up once, after every module
 * has been built, and never fails a request: instrumentation that can throw inside a customer's own
 * code path is worse than a metric that goes missing.
 */
@Injectable()
export class ObserveTelemetrySink implements TelemetrySink, OnApplicationBootstrap {
  private tracer: TracerService | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  onApplicationBootstrap(): void {
    try {
      this.tracer = this.moduleRef.get(TracerService, { strict: false });
    } catch {
      // Observe is not registered (no credentials): stay a no-op.
      this.tracer = null;
    }
  }

  tag(key: string, value: string | number | boolean): void {
    const tracer = this.tracer;
    if (!tracer) return;
    // `activeSpan()` rejects when there is no span (a job, a scheduled run): nothing to tag.
    tracer
      .activeSpan()
      .then((span) => {
        span.setTag(key, value);
      })
      .catch(() => undefined);
  }

  count(name: string, labels: Record<string, string>): void {
    const tracer = this.tracer;
    if (!tracer) return;
    try {
      tracer.counter<string>(name, { labels: Object.keys(labels) }).increment(labels);
    } catch {
      // A refused series (over the label cap) or a closed agent must not reach the caller.
    }
  }
}

/** Used where nothing can be registered (unit tests, CLI contexts). */
export class NoopTelemetrySink implements TelemetrySink {
  tag(): void {}
  count(): void {}
}
