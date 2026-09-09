import type { SelectOption } from '@/app/shared/ui/select-field';

/**
 * Matches the countries backend/scripts/seed-commerce.ts actually seeds
 * shipping zones for. Shared between every address form (checkout,
 * account/addresses) so "which countries does this app know about" has
 * one answer instead of drifting per page.
 */
export const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
];
