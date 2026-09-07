import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Formats integer minor units for display: 4499 -> "$44.99".
 *
 * The API is integer-minor end to end, so this is the ONLY place a division
 * happens. Dividing earlier would put floats into values that later get
 * summed, which is exactly the rounding drift the backend avoids by never
 * using floats at all.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(minorUnits: number | null | undefined, currency = 'USD', locale = 'en-US'): string {
    if (minorUnits === null || minorUnits === undefined) return '';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(minorUnits / 100);
  }
}
