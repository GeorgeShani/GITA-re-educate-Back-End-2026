import { dmyDay, isoDay, pad, randomFrom } from './random.js';
import { GEORGIAN_FIRST, GEORGIAN_LAST, adultBirthDate, exampleEmail, fullName, georgianPhone } from './shared.js';
import { type Table, withFlaws } from './table.js';
import type { CompanyContent } from './types.js';

const STORES = ['Vake', 'Saburtalo', 'Batumi Boulevard', 'Kutaisi Center'] as const;
const CATEGORIES = ['Dairy', 'Bakery', 'Beverages', 'Produce', 'Household', 'Snacks', 'Frozen'] as const;
const BRANDS = ['Kolkheti', 'Borjomi', 'Natakhtari', 'Sulguni House', 'Tbilisi Bakery', 'Ajara Farm', 'Marneuli Fresh'] as const;
const PRODUCTS = ['Whole milk 1 l', 'Sulguni 400 g', 'Shotis puri', 'Khachapuri frozen', 'Mineral water 1.5 l', 'Lemonade 0.5 l', 'Tomatoes 1 kg', 'Cucumbers 1 kg', 'Dish soap 500 ml', 'Hazelnut mix 200 g', 'Churchkhela', 'Tkemali 250 ml', 'Yogurt 500 g', 'Dumplings 1 kg'] as const;
const SUPPLIERS = ['Kolkheti Foods', 'Natakhtari Distribution', 'Ajara Farm Co-op', 'Caucasus Beverages'] as const;

function salesByStore(): Table {
  const random = randomFrom(3101);
  return withFlaws(
    {
      header: ['date', 'store', 'category', 'units', 'revenue_gel', 'discount_pct'],
      rows: Array.from({ length: 600 }, () => {
        const units = random.int(6, 420);
        return [random.chance(0.05) ? dmyDay(-random.int(0, 60)) : isoDay(-random.int(0, 60)), random.pick(STORES), random.pick(CATEGORIES), String(units), (units * random.money(1.2, 9.5)).toFixed(2), String(random.pick([0, 0, 0, 5, 10, 15]))];
      }),
    },
    { spaces: { columns: ['store'], rate: 0.04 }, blank: { columns: ['discount_pct'], rate: 0.02 } },
    random,
  );
}

function productCatalogue(): Table {
  const random = randomFrom(3201);
  return withFlaws(
    {
      header: ['sku', 'name', 'category', 'brand', 'price_gel', 'stock'],
      rows: Array.from({ length: 140 }, (_, index) => [`KV-${pad(2_000 + index, 5)}`, random.pick(PRODUCTS), random.pick(CATEGORIES), random.pick(BRANDS), random.money(0.9, 38).toFixed(2), String(random.int(0, 800))]),
    },
    { placeholder: { columns: ['brand'], rate: 0.03, text: 'n/a' }, duplicateRows: 0.015 },
    random,
  );
}

function loyaltySignups(): Table {
  const random = randomFrom(3301);
  return {
    header: ['member_id', 'full_name', 'email', 'phone', 'date_of_birth', 'joined_on', 'store'],
    rows: Array.from({ length: 180 }, (_, index) => {
      const name = fullName(random, GEORGIAN_FIRST, GEORGIAN_LAST);
      return [`LM-${pad(index + 1, 5)}`, name, exampleEmail(name, random, 'example.ge'), georgianPhone(random), adultBirthDate(random), isoDay(-random.int(0, 400)), random.pick(STORES)];
    }),
  };
}

function supplierPrices(version: 1 | 2): Table {
  const random = randomFrom(3401);
  const rows = Array.from({ length: 100 }, (_, index) => ({ sku: `KV-${pad(2_000 + index, 5)}`, supplier: random.pick(SUPPLIERS), cost: random.money(0.4, 24), validFrom: -random.int(10, 200) }));
  const later = randomFrom(3402);
  const shown = version === 1 ? rows : rows.map((row) => (later.chance(0.35) ? { ...row, cost: Math.round(row.cost * later.pick([1.03, 1.05, 1.08, 0.97]) * 100) / 100, validFrom: -later.int(0, 5) } : row));
  return { header: ['sku', 'supplier', 'cost_gel', 'valid_from'], rows: shown.map((row) => [row.sku, row.supplier, row.cost.toFixed(2), isoDay(row.validFrom)]) };
}

function staffHours(): Table {
  const random = randomFrom(3501);
  return withFlaws(
    {
      header: ['staff_name', 'store', 'week_start', 'hours'],
      rows: Array.from({ length: 80 }, (_, index) => [fullName(random, GEORGIAN_FIRST, GEORGIAN_LAST), STORES[index % STORES.length] ?? 'Vake', isoDay(-7 * (index % 6)), String(random.pick([20, 24, 32, 36, 40, 44]))]),
    },
    { spaces: { columns: ['staff_name'], rate: 0.05 } },
    random,
  );
}

/** Kavkasia Retail: a small shop chain on the Free plan, so six uploads and a handful of rules. */
export function kavkasiaContent(): CompanyContent {
  return {
    files: [
      { key: 'sales', name: 'sales-by-store.csv', format: 'csv', table: salesByStore(), uploader: 'admin' },
      { key: 'catalogue', name: 'product-catalogue.csv', format: 'csv', table: productCatalogue(), uploader: 'admin' },
      { key: 'loyalty', name: 'loyalty-signups.csv', format: 'csv', table: loyaltySignups(), uploader: 'admin' },
      { key: 'prices', name: 'supplier-prices.csv', format: 'csv', table: supplierPrices(1), uploader: 'admin' },
      { key: 'hours', name: 'staff-hours.csv', format: 'csv', table: staffHours(), uploader: 'admin' },
    ],
    versions: [{ of: 'prices', name: 'supplier-prices.csv', format: 'csv', table: supplierPrices(2), uploader: 'admin' }],
    keyColumns: { prices: ['sku'] },
    rules: [
      { name: 'Every product has a SKU', kind: 'required_column', columnName: 'sku', severity: 'error' },
      { name: 'Prices are numbers', kind: 'type_is', columnName: 'price_gel', params: { type: 'number' }, severity: 'error' },
      { name: 'No personal data', kind: 'no_sensitive_data', severity: 'warning' },
    ],
    clean: { file: 'catalogue', recipe: { steps: [{ step: 'drop_duplicate_rows' }, { step: 'replace_values', column: 'brand', values: ['n/a'] }, { step: 'trim_whitespace' }] } },
    comments: [],
    asks: [{ file: 'sales', question: 'Total revenue by store' }],
    explores: [{ file: 'sales', query: { groupBy: ['store'], measures: [{ fn: 'sum', column: 'revenue_gel' }, { fn: 'sum', column: 'units' }], sort: { by: 'measure', index: 0, direction: 'desc' } } }],
  };
}
