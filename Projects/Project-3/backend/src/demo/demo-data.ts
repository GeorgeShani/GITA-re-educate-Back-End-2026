/** What the demo company contains. Fixed strings, no randomness: seeding twice would produce the same company. */

export const DEMO_COMPANY = {
  name: 'Northwind Analytics (Demo)',
  billingEmail: 'billing@demo.gridline.test',
  country: 'GE',
  industry: 'technology',
} as const;

export const DEMO_ADMIN = { email: 'admin@demo.gridline.test', fullName: 'Demo Admin' } as const;

export const DEMO_EMPLOYEES = [
  { email: 'nino@demo.gridline.test', fullName: 'Nino Beridze' },
  { email: 'luka@demo.gridline.test', fullName: 'Luka Gelashvili' },
  { email: 'mariam@demo.gridline.test', fullName: 'Mariam Kapanadze' },
] as const;

/** Data-quality rules the demo company has, so its reports show a quality score and a failure or two. */
export const DEMO_RULES = [
  { name: 'Emails are filled in', columnName: 'email', severity: 'error', kind: 'max_null_percent', params: { max: 5 } },
  { name: 'Order amounts are positive', columnName: 'amount', severity: 'warning', kind: 'min_value', params: { min: 0 } },
  { name: 'No repeated rows', columnName: null, severity: 'error', kind: 'max_duplicate_rows', params: { max: 0 } },
] as const;

export interface DemoFile {
  name: string;
  csv: string;
  /** Who uploaded it: an index into `DEMO_EMPLOYEES`, or `admin`. */
  uploader: number | 'admin';
  /** Days before the seed instant. */
  daysAgo: number;
  /** Restricted files are visible to the uploader, the admin and the listed employee indexes. */
  restrictedTo?: readonly number[];
}

const REGIONS = ['North', 'South', 'East', 'West'] as const;

function sales(): string {
  const rows = ['order_id,region,amount,order_date'];
  for (let index = 1; index <= 60; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    rows.push(`${1000 + index},${REGIONS[index % 4]},${(40 + ((index * 37) % 260)).toFixed(2)},2026-02-${day}`);
  }
  return `${rows.join('\n')}\n`;
}

function customers(): string {
  // Deliberately messy: blanks, a mixed-type column and a repeated row, so the report has something to say.
  const rows = ['customer_id,name,email,age,signup_date'];
  for (let index = 1; index <= 40; index += 1) {
    const email = index % 6 === 0 ? '' : `customer${index}@example.test`;
    const age = index % 9 === 0 ? 'n/a' : String(20 + ((index * 7) % 45));
    rows.push(`${index},Customer ${index},${email},${age},2025-${String((index % 12) + 1).padStart(2, '0')}-15`);
  }
  rows.push('7,Customer 7,customer7@example.test,29,2025-08-15');
  rows.push('7,Customer 7,customer7@example.test,29,2025-08-15');
  return `${rows.join('\n')}\n`;
}

function inventory(): string {
  const rows = ['sku,warehouse,on_hand,reorder_level'];
  for (let index = 1; index <= 50; index += 1) {
    rows.push(`SKU-${String(index).padStart(4, '0')},WH-${(index % 3) + 1},${(index * 13) % 400},${20 + (index % 5) * 10}`);
  }
  return `${rows.join('\n')}\n`;
}

function payroll(): string {
  const rows = ['employee,department,monthly_salary'];
  for (let index = 1; index <= 20; index += 1) {
    rows.push(`Employee ${index},Dept ${(index % 4) + 1},${2000 + index * 75}`);
  }
  return `${rows.join('\n')}\n`;
}

export const DEMO_FILES: readonly DemoFile[] = [
  // Uploaded in the previous billing period, so the demo invoice has usage behind it.
  { name: 'sales-january.csv', csv: sales(), uploader: 0, daysAgo: 33 },
  { name: 'inventory-snapshot.csv', csv: inventory(), uploader: 2, daysAgo: 31 },
  // This period.
  { name: 'sales-february.csv', csv: sales(), uploader: 0, daysAgo: 6 },
  { name: 'customer-export.csv', csv: customers(), uploader: 1, daysAgo: 4 },
  { name: 'warehouse-levels.csv', csv: inventory(), uploader: 2, daysAgo: 2 },
  // Restricted: only the admin, its uploader and Luka (index 1) can see it.
  { name: 'payroll-draft.csv', csv: payroll(), uploader: 'admin', daysAgo: 1, restrictedTo: [1] },
];
