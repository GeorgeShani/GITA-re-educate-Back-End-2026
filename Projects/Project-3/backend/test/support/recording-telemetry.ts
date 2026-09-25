import type { TelemetrySink } from '#/core/telemetry/telemetry-sink.js';

/** Stands in for Observe: remembers every counter increment and span tag, so a spec can assert what was reported. */
export class RecordingTelemetry implements TelemetrySink {
  counts: Array<{ name: string; labels: Record<string, string> }> = [];
  tags: Array<[string, string | number | boolean]> = [];

  count(name: string, labels: Record<string, string>): void {
    this.counts.push({ name, labels });
  }

  tag(key: string, value: string | number | boolean): void {
    this.tags.push([key, value]);
  }

  /** Every increment of one metric, in order. */
  of(name: string): Array<Record<string, string>> {
    return this.counts.filter((entry) => entry.name === name).map((entry) => entry.labels);
  }

  clear(): void {
    this.counts = [];
    this.tags = [];
  }
}
