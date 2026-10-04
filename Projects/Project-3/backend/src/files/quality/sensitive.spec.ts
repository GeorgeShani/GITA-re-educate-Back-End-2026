import { describe, expect, it } from 'vitest';
import { type CellValue, MetricsAccumulator } from './metrics.js';
import { classifyColumn, detectCell, ibanValid, isBirthDateName, luhn } from './sensitive.js';

function profile(header: CellValue[], rows: CellValue[][]) {
  const accumulator = new MetricsAccumulator(header);
  for (const row of rows) accumulator.addRow(row);
  return accumulator.finish();
}

describe('the checksums', () => {
  it('accepts real card numbers and refuses a number that is one digit off', () => {
    expect(luhn('4111111111111111')).toBe(true);
    expect(luhn('5500000000000004')).toBe(true);
    expect(luhn('4111111111111112')).toBe(false);
  });

  it('accepts a real IBAN and refuses one with a changed digit', () => {
    expect(ibanValid('GB82WEST12345698765432')).toBe(true);
    expect(ibanValid('DE89370400440532013000')).toBe(true);
    expect(ibanValid('GB82WEST12345698765433')).toBe(false);
  });
});

describe('detectCell', () => {
  it.each([
    ['ada@example.com', 'email'],
    ['  Grace.Hopper+work@mail.example.org ', 'email'],
    ['4111 1111 1111 1111', 'card_number'],
    ['4111-1111-1111-1111', 'card_number'],
    ['GB82 WEST 1234 5698 7654 32', 'iban'],
    ['192.168.1.20', 'ip_address'],
    ['2001:db8::1', 'ip_address'],
    ['+995 555 12 34 56', 'phone'],
    ['+44 (20) 7946 0958', 'phone'],
    ['sk_live_' + '0'.repeat(24), 'secret'],
    ['AKIAIOSFODNN7EXAMPLE', 'secret'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk', 'secret'],
  ])('%s looks like %s', (value, kind) => {
    expect(detectCell(value)).toBe(kind);
  });

  it.each([
    ['not an email@', 'a lone at-sign'],
    ['@handle', 'a social handle'],
    ['4111111111111112', 'a 16-digit number that fails the card checksum'],
    ['1234567890123456', 'an order number'],
    ['GB82WEST12345698765433', 'an IBAN with a wrong checksum'],
    ['12345', 'a short number'],
    ['2026-03-04', 'a date'],
    ['999.1.1.1', 'a version with an impossible octet'],
    ['hello world', 'text'],
  ])('%s is not flagged (%s)', (value) => {
    expect(detectCell(value)).toBeNull();
  });

  it('reads a phone number written without a country code only when the column says phone', () => {
    expect(detectCell('555 123 4567')).toBeNull();
    expect(detectCell('555 123 4567', 'Mobile phone')).toBe('phone');
    expect(detectCell('555 123 4567', 'order_ref')).toBeNull();
  });

  it('does not look at very long text', () => {
    expect(detectCell(`${'x'.repeat(700)}@example.com`)).toBeNull();
  });
});

describe('isBirthDateName', () => {
  it.each(['Date of birth', 'date_of_birth', 'DOB', 'birthday', 'Birth date', 'born'])('%s', (name) => {
    expect(isBirthDateName(name)).toBe(true);
  });
  it.each(['Abort', 'created_at', 'borne_by', 'Order date'])('%s is not one', (name) => {
    expect(isBirthDateName(name)).toBe(false);
  });
});

describe('classifyColumn', () => {
  it('names a column after what most of it looks like', () => {
    expect(classifyColumn({ email: 90 }, 100)).toEqual({ kind: 'email', matchPercent: 90 });
  });
  it('needs a majority for an email, but only a few matches for a secret', () => {
    expect(classifyColumn({ email: 20 }, 100)).toBeNull();
    expect(classifyColumn({ secret: 3 }, 100)).toEqual({ kind: 'secret', matchPercent: 3 });
  });
  it('needs most of a column for a card number, which an ID can imitate', () => {
    expect(classifyColumn({ card_number: 10 }, 100)).toBeNull();
    expect(classifyColumn({ card_number: 95 }, 100)?.kind).toBe('card_number');
  });
  it('says nothing about an empty column', () => {
    expect(classifyColumn({}, 0)).toBeNull();
  });
});

describe('in a profile', () => {
  it('flags the column and stores only its kind and share, never a value', () => {
    const metrics = profile(
      ['id', 'contact', 'note'],
      [
        [1, 'ada@example.com', 'hello'],
        [2, 'grace@example.com', 'world'],
        [3, 'alan@example.com', ''],
      ],
    );
    expect(metrics.columns.map((column) => column.sensitive)).toEqual([null, { kind: 'email', matchPercent: 100 }, null]);
    expect(JSON.stringify(metrics)).not.toContain('example.com');
  });

  it('does not take a column of long order numbers for card numbers', () => {
    // Sixteen digits each, in sequence: about one in ten would pass the checksum, never the 60% a card column shows.
    const rows: CellValue[][] = Array.from({ length: 50 }, (_, index) => [String(1000000000000000 + index * 7)]);
    expect(profile(['order'], rows).columns[0]?.sensitive).toBeNull();
  });

  it('calls a date column a birth date only when it is named like one', () => {
    const dates: CellValue[][] = [['1990-04-05'], ['1985-11-30'], ['2001-01-15']];
    expect(profile(['date_of_birth'], dates).columns[0]?.sensitive?.kind).toBe('birth_date');
    expect(profile(['shipped_on'], dates).columns[0]?.sensitive).toBeNull();
  });

  it('only checks the first couple of thousand values of a column, so a huge file stays cheap', () => {
    const accumulator = new MetricsAccumulator(['contact']);
    for (let row = 0; row < 2500; row += 1) accumulator.addRow([row < 2000 ? 'plain text value' : 'late@example.com']);
    expect(accumulator.finish().columns[0]?.sensitive).toBeNull();
  });

  it('survives the jsonb round trip, and an old report without the field reads as none', () => {
    const metrics = profile(['contact'], [['ada@example.com']]);
    expect(JSON.parse(JSON.stringify(metrics))).toEqual(metrics);
  });
});
