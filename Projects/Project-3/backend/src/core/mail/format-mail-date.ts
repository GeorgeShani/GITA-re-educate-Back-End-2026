const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * A date as an email says it: "March 8, 2026". Billing periods and grace periods are UTC days everywhere else, so this is
 * too: an instant is shown as the UTC day it falls on, never shifted into the server's own zone.
 */
export function formatMailDate(value: Date): string {
  return LONG_DATE.format(value);
}
