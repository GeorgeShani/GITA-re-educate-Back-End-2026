import { dmyDay, isoDay, pad, randomFrom } from './random.js';
import {
  GEORGIAN_FIRST,
  GEORGIAN_LAST,
  adultBirthDate,
  exampleEmail,
  fullName,
  georgianIban,
  georgianPhone,
} from './shared.js';
import { type Table, withFlaws } from './table.js';
import type { CompanyContent } from './types.js';

const CITIES = ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Poti', 'Zugdidi', 'Gori', 'Telavi', 'Istanbul', 'Baku', 'Yerevan', 'Trabzon'] as const;
const CARRIERS = ['Caucasus Freight', 'Black Sea Lines', 'Silk Road Express', 'Own fleet'] as const;
const STATUSES = ['Delivered', 'Delivered', 'Delivered', 'In transit', 'Delayed', 'Returned'] as const;
const PRODUCTS = ['Pallet wrap 500 mm', 'Corner boards', 'Euro pallet', 'Cargo straps 5 t', 'Thermal blanket', 'Bubble film roll', 'Carton 60x40x40', 'Label roll 100x150', 'Safety vest', 'Forklift battery', 'Dock bumper', 'Stretch hood'] as const;
const WAREHOUSES = ['Tbilisi DC', 'Batumi Port', 'Kutaisi Hub'] as const;
const STATIONS = ['Wissol Gldani', 'Socar Rustavi', 'Gulf Batumi', 'Lukoil Kutaisi', 'Portal Poti'] as const;
const CUSTOMERS = ['Aragvi Foods', 'Bakuriani Ski Supply', 'Kolkheti Tea', 'Mtkvari Textiles', 'Svaneti Honey', 'Iveria Pharma', 'Black Sea Timber', 'Rioni Packaging', 'Kakheti Cellars', 'Alazani Dairy'] as const;
const MECHANICS = ['Besik Tabatadze', 'Irma Kobakhidze', 'Gela Mchedlishvili', 'Zaza Ninidze'] as const;

interface ShipmentRow {
  id: string;
  orderOffset: number;
  origin: string;
  destination: string;
  carrier: string;
  weight: number;
  status: string;
  cost: number;
  customer: string;
  email: string;
}

function baseShipments(): ShipmentRow[] {
  const random = randomFrom(1101);
  return Array.from({ length: 360 }, (_, index) => {
    const origin = random.pick(CITIES);
    let destination = random.pick(CITIES);
    if (destination === origin) destination = 'Tbilisi';
    const weight = random.int(80, 18_000);
    const customer = random.pick(CUSTOMERS);
    return {
      id: `NW-2026-${pad(10_000 + index, 6)}`,
      orderOffset: -random.int(1, 75),
      origin,
      destination,
      carrier: random.pick(CARRIERS),
      weight,
      status: random.pick(STATUSES),
      cost: random.money(60, 40 + weight * 0.22),
      customer,
      email: exampleEmail(`${customer.split(' ')[0]} accounts`, random, 'example.ge'),
    };
  });
}

function shipmentTable(rows: readonly ShipmentRow[], seed: number): Table {
  const random = randomFrom(seed);
  const table: Table = {
    header: ['shipment_id', 'order_date', 'origin', 'destination', 'carrier', 'weight_kg', 'status', 'freight_cost_usd', 'customer_email', 'delivered_on'],
    rows: rows.map((row) => [
      row.id,
      // A few people type dates the way they say them: the report finds the column mixed, and Clean can fix it.
      random.chance(0.06) ? dmyDay(row.orderOffset) : isoDay(row.orderOffset),
      row.origin,
      row.destination,
      row.carrier,
      String(row.weight),
      row.status,
      row.cost.toFixed(2),
      row.email,
      row.status === 'Delivered' ? isoDay(row.orderOffset + random.int(1, 9)) : '',
    ]),
  };
  return withFlaws(
    table,
    {
      placeholder: { columns: ['weight_kg'], rate: 0.03 },
      spaces: { columns: ['destination', 'carrier'], rate: 0.04 },
      duplicateRows: 0.012,
    },
    random,
  );
}

/** The next version: a dozen new shipments, a few withdrawn, and many statuses moved on. Matched by `shipment_id`. */
function nextShipments(): Table {
  const random = randomFrom(1102);
  const base = baseShipments();
  const kept = base.filter(() => !random.chance(0.014)).map((row) => {
    if (row.status === 'In transit') return { ...row, status: random.pick(['Delivered', 'Delivered', 'Delayed']) };
    if (row.status === 'Delayed') return { ...row, status: random.pick(['Delivered', 'Returned']) };
    return row;
  });
  const added = Array.from({ length: 14 }, (_, index): ShipmentRow => {
    const customer = random.pick(CUSTOMERS);
    return {
      id: `NW-2026-${pad(10_360 + index, 6)}`,
      orderOffset: -random.int(0, 3),
      origin: random.pick(CITIES),
      destination: 'Tbilisi',
      carrier: random.pick(CARRIERS),
      weight: random.int(120, 9_000),
      status: 'In transit',
      cost: random.money(80, 1_900),
      customer,
      email: exampleEmail(`${customer.split(' ')[0]} accounts`, random, 'example.ge'),
    };
  });
  return shipmentTable([...kept, ...added], 1103);
}

function fleetMaintenance(): Table {
  const random = randomFrom(1201);
  return {
    header: ['vehicle_id', 'plate', 'make_model', 'last_service', 'odometer_km', 'next_service_due', 'mechanic', 'cost_usd'],
    rows: Array.from({ length: 28 }, (_, index) => {
      const odometer = random.int(42_000, 610_000);
      const last = -random.int(5, 140);
      return [
        `TRK-${pad(index + 1, 3)}`,
        `${random.pick(['AB', 'BC', 'KT', 'XZ'])}-${pad(random.int(100, 999), 3)}-${random.pick(['CD', 'EF', 'GH', 'JK'])}`,
        random.pick(['Volvo FH 460', 'MAN TGX 18.510', 'Scania R 450', 'Mercedes Actros 1845', 'DAF XF 480']),
        isoDay(last),
        String(odometer),
        isoDay(last + random.int(90, 180)),
        random.pick(MECHANICS),
        random.money(180, 4_800).toFixed(2),
      ];
    }),
  };
}

function warehouseStock(version: 1 | 2): Table {
  const random = randomFrom(1301);
  const rows = Array.from({ length: 150 }, (_, index) => ({
    sku: `WH-${pad(400 + index, 5)}`,
    product: random.pick(PRODUCTS),
    warehouse: random.pick(WAREHOUSES),
    onHand: random.int(0, 900),
    reorder: random.int(20, 240),
    cost: random.money(0.8, 320),
    countedOffset: -random.int(1, 40),
  }));
  const later = randomFrom(1302);
  const shown = version === 1
    ? rows
    : [
        ...rows
          .filter(() => !later.chance(0.02))
          .map((row) => (later.chance(0.4) ? { ...row, onHand: Math.max(0, row.onHand + later.int(-120, 160)), countedOffset: -later.int(0, 3) } : row)),
        ...Array.from({ length: 6 }, (_, index) => ({
          sku: `WH-${pad(550 + index, 5)}`,
          product: later.pick(PRODUCTS),
          warehouse: later.pick(WAREHOUSES),
          onHand: later.int(10, 400),
          reorder: later.int(20, 240),
          cost: later.money(0.8, 320),
          countedOffset: -later.int(0, 3),
        })),
      ];
  const flawRandom = randomFrom(version === 1 ? 1303 : 1304);
  return withFlaws(
    {
      header: ['sku', 'product', 'warehouse', 'on_hand', 'reorder_level', 'unit_cost_usd', 'last_counted'],
      rows: shown.map((row) => [row.sku, row.product, row.warehouse, String(row.onHand), String(row.reorder), row.cost.toFixed(2), isoDay(row.countedOffset)]),
    },
    { blank: { columns: ['last_counted'], rate: 0.03 }, spaces: { columns: ['product'], rate: 0.03 } },
    flawRandom,
  );
}

/** Drivers' personal details: phone numbers, IBANs and dates of birth, so the personal-data scan has real work. */
function driverRoster(): Table {
  const random = randomFrom(1401);
  return {
    header: ['driver_id', 'full_name', 'phone', 'iban', 'date_of_birth', 'licence_class', 'licence_expiry', 'hire_date'],
    rows: Array.from({ length: 24 }, (_, index) => [
      `DRV-${pad(index + 1, 3)}`,
      fullName(random, GEORGIAN_FIRST, GEORGIAN_LAST),
      georgianPhone(random),
      georgianIban(random),
      adultBirthDate(random),
      random.pick(['C', 'CE', 'C1E']),
      isoDay(random.int(40, 900)),
      isoDay(-random.int(120, 3_000)),
    ]),
  };
}

function customerInvoices(): Table {
  const random = randomFrom(1501);
  const table: Table = {
    header: ['invoice_no', 'customer', 'issued', 'due', 'amount_usd', 'status', 'payment_ref'],
    rows: Array.from({ length: 220 }, (_, index) => {
      const issued = -random.int(1, 120);
      const status = random.pick(['Paid', 'Paid', 'Paid', 'Open', 'Overdue']);
      return [
        `INV-${pad(7_000 + index, 5)}`,
        random.pick(CUSTOMERS),
        isoDay(issued),
        isoDay(issued + 30),
        random.money(120, 14_500).toFixed(2),
        status,
        status === 'Paid' ? `TB${random.int(10_000_000, 99_999_999)}` : '',
      ];
    }),
  };
  return withFlaws(table, { placeholder: { columns: ['customer'], rate: 0.025, text: 'unknown' }, spaces: { columns: ['customer'], rate: 0.05 }, duplicateRows: 0.02 }, random);
}

function fuelPurchases(): Table {
  const random = randomFrom(1601);
  return withFlaws(
    {
      header: ['date', 'vehicle_id', 'station', 'litres', 'price_per_litre_usd', 'total_usd'],
      rows: Array.from({ length: 300 }, () => {
        const litres = random.money(60, 520);
        const price = random.money(0.92, 1.18);
        return [isoDay(-random.int(0, 90)), `TRK-${pad(random.int(1, 28), 3)}`, random.pick(STATIONS), litres.toFixed(2), price.toFixed(2), (litres * price).toFixed(2)];
      }),
    },
    { blank: { columns: ['station'], rate: 0.02 } },
    random,
  );
}

function customsDeclarations(): Table {
  const random = randomFrom(1701);
  return {
    header: ['declaration_no', 'shipment_id', 'border_post', 'hs_code', 'declared_value_usd', 'duty_usd', 'cleared_on'],
    rows: Array.from({ length: 90 }, (_, index) => {
      const value = random.money(900, 48_000);
      return [
        `CD-${pad(2_000 + index, 5)}`,
        `NW-2026-${pad(10_000 + random.int(0, 359), 6)}`,
        random.pick(['Sarpi', 'Red Bridge', 'Sadakhlo', 'Larsi', 'Poti Port']),
        random.pick(['4819.10', '3923.21', '8427.10', '6307.90', '3919.90']),
        value.toFixed(2),
        (value * random.pick([0, 0.05, 0.12])).toFixed(2),
        isoDay(-random.int(0, 60)),
      ];
    }),
  };
}

/** Northwind Logistics: shipments and the warehouse, with a second version of each, and the drivers' private details. */
export function northwindContent(): CompanyContent {
  return {
    files: [
      { key: 'shipments', name: 'shipments-q3.csv', format: 'csv', table: shipmentTable(baseShipments(), 1104), uploader: 0 },
      { key: 'fleet', name: 'fleet-maintenance.xlsx', format: 'xlsx', table: fleetMaintenance(), uploader: 1 },
      { key: 'stock', name: 'warehouse-stock.csv', format: 'csv', table: warehouseStock(1), uploader: 2 },
      // Restricted: the admin, its uploader and the HR-minded employees at positions 3 and 4.
      { key: 'drivers', name: 'driver-roster.csv', format: 'csv', table: driverRoster(), uploader: 'admin', access: { visibility: 'restricted', grantedTo: [3, 4] } },
      { key: 'invoices', name: 'customer-invoices.csv', format: 'csv', table: customerInvoices(), uploader: 4 },
      { key: 'fuel', name: 'fuel-purchases.csv', format: 'csv', table: fuelPurchases(), uploader: 5 },
      { key: 'customs', name: 'customs-declarations.csv', format: 'csv', table: customsDeclarations(), uploader: 3 },
    ],
    versions: [
      { of: 'shipments', name: 'shipments-q3.csv', format: 'csv', table: nextShipments(), uploader: 0 },
      { of: 'stock', name: 'warehouse-stock.csv', format: 'csv', table: warehouseStock(2), uploader: 2 },
    ],
    keyColumns: { shipments: ['shipment_id'], stock: ['sku'] },
    rules: [
      { name: 'Shipment ids are never blank', kind: 'max_null_percent', columnName: 'shipment_id', params: { max: 0 }, severity: 'error' },
      { name: 'Shipment ids are unique', kind: 'unique', columnName: 'shipment_id', severity: 'error' },
      { name: 'No more than 2% of weights missing', kind: 'max_null_percent', columnName: 'weight_kg', params: { max: 2 }, severity: 'warning' },
      { name: 'Freight cost is a number', kind: 'type_is', columnName: 'freight_cost_usd', params: { type: 'number' }, severity: 'error' },
      { name: 'No personal data in shared files', kind: 'no_sensitive_data', severity: 'warning' },
    ],
    clean: {
      file: 'shipments',
      recipe: {
        steps: [
          { step: 'trim_whitespace' },
          { step: 'drop_duplicate_rows' },
          { step: 'standardise_dates', column: 'order_date', order: 'dmy' },
          { step: 'replace_values', column: 'weight_kg', values: ['N/A'] },
        ],
      },
    },
    comments: [
      { file: 'shipments', author: 0, body: 'Q3 is in. Anyone who sees odd dates in order_date: that is the manual entries, I will clean them tomorrow.', mentions: [1, 2] },
      { file: 'shipments', author: 1, body: 'Thanks Nino. The Batumi rows look right to me, the destination column has a few trailing spaces.', replyTo: 0 },
      { file: 'stock', author: 2, body: 'Second count of the Tbilisi DC is in. Reorder levels on the straps are too low, can someone take a look?', mentions: [4] },
      { file: 'invoices', author: 4, body: 'Four invoices show customer "unknown". Chasing accounts for the names.', mentions: [0] },
    ],
    asks: [
      { file: 'shipments', question: 'Total freight cost by carrier, highest first' },
      { file: 'stock', question: 'How many units are on hand in each warehouse?' },
    ],
    explores: [
      { file: 'shipments', query: { groupBy: ['status'], measures: [{ fn: 'count' }, { fn: 'sum', column: 'freight_cost_usd' }], sort: { by: 'measure', index: 0, direction: 'desc' } } },
      { file: 'invoices', query: { filters: [{ column: 'status', op: 'equals', value: 'Overdue' }], groupBy: ['customer'], measures: [{ fn: 'sum', column: 'amount_usd' }], sort: { by: 'measure', index: 0, direction: 'desc' }, limit: 10 } },
    ],
  };
}
