import { describe, expect, it } from 'vitest';
import { BusinessMetrics, METRICS } from './business-metrics.js';
import { NoopTelemetrySink, type TelemetrySink } from './telemetry-sink.js';

class Recorder implements TelemetrySink {
  readonly counts: Array<{ name: string; labels: Record<string, string> }> = [];
  readonly tags: Array<[string, string | number | boolean]> = [];

  count(name: string, labels: Record<string, string>): void {
    this.counts.push({ name, labels });
  }

  tag(key: string, value: string | number | boolean): void {
    this.tags.push([key, value]);
  }
}

describe('BusinessMetrics', () => {
  it('names each business event with a stable metric name and only the bounded `plan` (and outcome) labels', () => {
    const sink = new Recorder();
    const metrics = new BusinessMetrics(sink);

    metrics.fileUploaded('basic');
    metrics.quotaExceeded('free', 'blocked');
    metrics.quotaExceeded('premium', 'overage');
    metrics.subscriptionChanged('premium');
    metrics.invoiceFinalized('basic');

    expect(sink.counts).toEqual([
      { name: 'gridline.files.uploaded', labels: { plan: 'basic' } },
      { name: 'gridline.quota.exceeded', labels: { plan: 'free', outcome: 'blocked' } },
      { name: 'gridline.quota.exceeded', labels: { plan: 'premium', outcome: 'overage' } },
      { name: 'gridline.subscription.changed', labels: { plan: 'premium' } },
      { name: 'gridline.billing.invoice_finalized', labels: { plan: 'basic' } },
    ]);
  });

  it('the metric names are the documented contract', () => {
    expect(Object.values(METRICS).sort()).toEqual([
      'gridline.billing.invoice_finalized',
      'gridline.files.uploaded',
      'gridline.quota.exceeded',
      'gridline.subscription.changed',
    ]);
  });

  it('never puts a company or user id in a metric label (Observe caps a metric at 1000 series)', () => {
    const sink = new Recorder();
    const metrics = new BusinessMetrics(sink);
    metrics.fileUploaded('free');
    metrics.tagCompany('9d3c0b58-1111-4222-8333-444455556666');

    expect(JSON.stringify(sink.counts)).not.toContain('9d3c0b58');
    // The tenant goes on the SPAN, where per-tenant questions belong.
    expect(sink.tags).toEqual([['companyId', '9d3c0b58-1111-4222-8333-444455556666']]);
  });

  it('is a silent no-op when Observe is not registered', () => {
    const metrics = new BusinessMetrics(new NoopTelemetrySink());
    expect(() => {
      metrics.fileUploaded('free');
      metrics.quotaExceeded('free', 'blocked');
      metrics.subscriptionChanged('basic');
      metrics.invoiceFinalized('basic');
      metrics.tagCompany('c');
    }).not.toThrow();
  });
});
