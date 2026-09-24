import { describe, expect, it } from 'vitest';
import { computeLineItems } from './calculator.js';
import { parseLineItems } from './line-item.schema.js';
import { periodFor } from './period.js';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MARCH = periodFor(1, d('2026-03-10'));

describe('lineItemsSchema', () => {
  it('accepts every kind of line the calculator can produce, after a JSON round trip', () => {
    const basic = computeLineItems({
      plan: 'basic',
      period: MARCH,
      seatIntervals: [{ userId: 'u1', from: d('2026-03-11'), to: null }],
      filesThisPeriod: 0,
    });
    const premium = computeLineItems({
      plan: 'premium',
      period: MARCH,
      seatIntervals: [],
      filesThisPeriod: 1_200,
      upTo: d('2026-03-11'),
    });

    // jsonb stores JSON, so this is the shape that actually comes back.
    for (const { lineItems } of [basic, premium]) {
      const stored: unknown = JSON.parse(JSON.stringify(lineItems));
      expect(parseLineItems(stored)).toEqual(lineItems);
    }
    expect(premium.lineItems.map((line) => line.kind).sort()).toEqual(['overage', 'plan_base']);
  });

  it('rejects a corrupted stored value rather than passing it on', () => {
    expect(() => parseLineItems([{ kind: 'seat', amountCents: 'lots' }])).toThrow();
    expect(() => parseLineItems({ not: 'an array' })).toThrow();
    expect(() => parseLineItems([{ kind: 'refund', amountCents: -1 }])).toThrow();
  });
});
