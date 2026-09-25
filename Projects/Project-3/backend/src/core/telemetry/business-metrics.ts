import { Inject, Injectable } from '@nestjs/common';
import type { Plan } from '#/subscriptions/plan-catalog.js';
import { TELEMETRY_SINK, type TelemetrySink } from './telemetry-sink.js';

/** The metric names, in one place: a dashboard is built against these strings, so they are a contract. */
export const METRICS = {
  filesUploaded: 'gridline.files.uploaded',
  quotaExceeded: 'gridline.quota.exceeded',
  subscriptionChanged: 'gridline.subscription.changed',
  invoiceFinalized: 'gridline.billing.invoice_finalized',
} as const;

/** How an upload past the included quota was handled. */
export type QuotaOutcome = 'blocked' | 'overage';

/**
 * The business events worth a counter, named for what happened rather than for how Observe stores it.
 * Labels are the plan only — bounded, never a user or company id (Observe caps a metric at a thousand
 * series, and an unbounded label is a memory leak in the host process). The company is on the SPAN
 * (`companyId` tag set by the auth guard), which is where per-tenant questions belong.
 *
 * Every method is a silent no-op when Observe is not registered.
 */
@Injectable()
export class BusinessMetrics {
  constructor(@Inject(TELEMETRY_SINK) private readonly sink: TelemetrySink) {}

  fileUploaded(plan: Plan): void {
    this.sink.count(METRICS.filesUploaded, { plan });
  }

  quotaExceeded(plan: Plan, outcome: QuotaOutcome): void {
    this.sink.count(METRICS.quotaExceeded, { plan, outcome });
  }

  /** `to` is the plan now in force. */
  subscriptionChanged(to: Plan): void {
    this.sink.count(METRICS.subscriptionChanged, { plan: to });
  }

  invoiceFinalized(plan: Plan): void {
    this.sink.count(METRICS.invoiceFinalized, { plan });
  }

  /** Tags the current request's trace with its tenant. */
  tagCompany(companyId: string): void {
    this.sink.tag('companyId', companyId);
  }
}
