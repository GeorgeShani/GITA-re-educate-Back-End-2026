import { dmyDay, isoDay, pad, randomFrom } from './random.js';
import { GERMAN_FIRST, GERMAN_LAST, adultBirthDate, exampleEmail, fullName, germanPhone } from './shared.js';
import { type Table, withFlaws } from './table.js';
import type { CompanyContent } from './types.js';

const CLINICS = ['Berlin Mitte', 'Hamburg Altona', 'München Schwabing'] as const;
const CLINICIANS = ['Dr. Keller', 'Dr. Brandt', 'Dr. Wagner', 'Dr. Hartmann', 'Dr. Schneider', 'Dr. Neumann'] as const;
const SPECIALTIES = ['General practice', 'Cardiology', 'Dermatology', 'Orthopaedics', 'Paediatrics'] as const;
const INSURERS = ['TK', 'AOK', 'Barmer', 'DAK', 'Private'] as const;
const SUPPLIERS = ['MedBedarf GmbH', 'Pharmalog AG', 'LabTech Nord', 'Hygienix', 'Praxisdepot'] as const;
const CONSUMABLES = ['Nitrile gloves M', 'Nitrile gloves L', 'Syringe 5 ml', 'Syringe 10 ml', 'Gauze 10x10', 'Surgical mask IIR', 'Disinfectant 1 l', 'Blood tube EDTA', 'Blood tube serum', 'Test strip glucose', 'Exam paper roll', 'Cannula 20G'] as const;
const TESTS = [
  ['HbA1c', '%', 4, 5.7],
  ['Cholesterol total', 'mg/dl', 120, 200],
  ['TSH', 'mIU/l', 0.4, 4],
  ['Haemoglobin', 'g/dl', 12, 17.5],
  ['CRP', 'mg/l', 0, 5],
  ['Creatinine', 'mg/dl', 0.6, 1.2],
  ['Vitamin D', 'ng/ml', 30, 100],
] as const;
const DEVICES = ['ECG', 'Ultrasound', 'Spirometer', 'Autoclave', 'Defibrillator', 'Centrifuge', 'Blood pressure monitor'] as const;
const COMMENTS = ['Kurze Wartezeit, freundliches Team.', 'Waiting time was too long on Monday.', 'Very thorough, thank you.', 'Terminvergabe online war einfach.', '', 'Parking is a problem.', 'Great care for my daughter.'] as const;

function appointments(): Table {
  const random = randomFrom(2101);
  const table: Table = {
    header: ['appointment_id', 'patient_ref', 'clinic', 'clinician', 'specialty', 'slot_start', 'duration_min', 'status', 'insurer'],
    rows: Array.from({ length: 480 }, (_, index) => {
      const day = -random.int(0, 28);
      const hour = random.int(8, 17);
      return [
        `AP-${pad(60_000 + index, 6)}`,
        `P-${random.int(10_000, 99_999)}`,
        random.pick(CLINICS),
        random.pick(CLINICIANS),
        random.pick(SPECIALTIES),
        `${isoDay(day)}T${pad(hour, 2)}:${random.pick(['00', '15', '30', '45'])}:00`,
        String(random.pick([10, 15, 20, 30, 45])),
        random.pick(['Completed', 'Completed', 'Completed', 'Completed', 'No-show', 'Cancelled', 'Booked']),
        random.pick(INSURERS),
      ];
    }),
  };
  return withFlaws(table, { blank: { columns: ['insurer'], rate: 0.02 }, spaces: { columns: ['clinic'], rate: 0.03 } }, random);
}

function labResults(): Table {
  const random = randomFrom(2201);
  return withFlaws(
    {
      header: ['sample_id', 'collected_on', 'test', 'result_value', 'unit', 'reference_low', 'reference_high', 'flagged'],
      rows: Array.from({ length: 440 }, (_, index) => {
        const [test, unit, low, high] = random.pick(TESTS);
        const value = Number(random.money(low * 0.8, high * 1.25).toFixed(2));
        return [`LAB-${pad(31_000 + index, 6)}`, isoDay(-random.int(0, 21)), test, String(value), unit, String(low), String(high), value < low || value > high ? 'yes' : 'no'];
      }),
    },
    { placeholder: { columns: ['result_value'], rate: 0.02, text: 'pending' } },
    random,
  );
}

function staffRota(): Table {
  const random = randomFrom(2301);
  return {
    header: ['staff_id', 'name', 'role', 'clinic', 'week_start', 'hours_planned', 'hours_worked', 'overtime_hours'],
    rows: Array.from({ length: 64 }, (_, index) => {
      const planned = random.pick([20, 30, 38, 40]);
      const worked = planned + random.int(-4, 6);
      return [
        `ST-${pad(100 + (index % 16), 3)}`,
        fullName(random, GERMAN_FIRST, GERMAN_LAST),
        random.pick(['GP', 'Nurse', 'Medical assistant', 'Reception', 'Specialist']),
        random.pick(CLINICS),
        isoDay(-7 * (index % 4)),
        String(planned),
        String(worked),
        String(Math.max(0, worked - planned)),
      ];
    }),
  };
}

function supplierInvoices(): Table {
  const random = randomFrom(2401);
  return withFlaws(
    {
      header: ['invoice_no', 'supplier', 'issued', 'due', 'net_eur', 'vat_eur', 'total_eur', 'status'],
      rows: Array.from({ length: 140 }, (_, index) => {
        const net = random.money(80, 9_200);
        const vat = Math.round(net * 19) / 100;
        const issued = -random.int(1, 100);
        return [`R-${2026}-${pad(400 + index, 4)}`, random.pick(SUPPLIERS), isoDay(issued), isoDay(issued + 30), net.toFixed(2), vat.toFixed(2), (net + vat).toFixed(2), random.pick(['Paid', 'Paid', 'Open', 'Disputed'])];
      }),
    },
    { duplicateRows: 0.05, spaces: { columns: ['supplier'], rate: 0.04 } },
    random,
  );
}

/** Patients to recall: names, addresses, phone numbers and dates of birth. Restricted, and exactly what the scan exists to find. */
function patientRecalls(): Table {
  const random = randomFrom(2501);
  return {
    header: ['recall_id', 'patient_name', 'email', 'phone', 'date_of_birth', 'due_on', 'reason'],
    rows: Array.from({ length: 90 }, (_, index) => {
      const name = fullName(random, GERMAN_FIRST, GERMAN_LAST);
      return [
        `RC-${pad(index + 1, 4)}`,
        name,
        exampleEmail(name, random, 'example.com'),
        germanPhone(random),
        adultBirthDate(random),
        isoDay(random.int(3, 60)),
        random.pick(['Annual check-up', 'Vaccination booster', 'Blood pressure follow-up', 'Skin screening', 'Diabetes review']),
      ];
    }),
  };
}

function consumables(version: 1 | 2): Table {
  const random = randomFrom(2601);
  const rows = Array.from({ length: 120 }, (_, index) => ({
    sku: `CS-${pad(1_000 + index, 5)}`,
    item: random.pick(CONSUMABLES),
    location: random.pick(CLINICS),
    onHand: random.int(0, 600),
    min: random.int(20, 150),
    price: random.money(0.4, 48),
  }));
  const later = randomFrom(2602);
  const shown = version === 1
    ? rows
    : [
        ...rows.filter(() => !later.chance(0.025)).map((row) => (later.chance(0.45) ? { ...row, onHand: Math.max(0, row.onHand + later.int(-90, 140)) } : row)),
        ...Array.from({ length: 5 }, (_, index) => ({ sku: `CS-${pad(1_200 + index, 5)}`, item: later.pick(CONSUMABLES), location: later.pick(CLINICS), onHand: later.int(10, 300), min: later.int(20, 150), price: later.money(0.4, 48) })),
      ];
  return withFlaws(
    { header: ['sku', 'item', 'location', 'on_hand', 'min_level', 'unit_price_eur'], rows: shown.map((row) => [row.sku, row.item, row.location, String(row.onHand), String(row.min), row.price.toFixed(2)]) },
    { spaces: { columns: ['item'], rate: 0.03 }, blank: { columns: ['location'], rate: 0.015 } },
    randomFrom(version === 1 ? 2603 : 2604),
  );
}

function equipmentRegister(): Table {
  const random = randomFrom(2701);
  return {
    header: ['asset_tag', 'device', 'clinic', 'purchased_on', 'last_calibrated', 'next_calibration_due', 'status'],
    rows: Array.from({ length: 45 }, (_, index) => {
      const calibrated = -random.int(10, 330);
      return [`EQ-${pad(index + 1, 3)}`, random.pick(DEVICES), random.pick(CLINICS), isoDay(-random.int(200, 2_400)), isoDay(calibrated), isoDay(calibrated + 365), random.pick(['In use', 'In use', 'In use', 'In repair', 'Retired'])];
    }),
  };
}

function satisfactionSurvey(): Table {
  const random = randomFrom(2801);
  return withFlaws(
    {
      header: ['response_id', 'submitted_on', 'clinic', 'nps_score', 'wait_minutes', 'comment'],
      rows: Array.from({ length: 260 }, (_, index) => [
        `SV-${pad(index + 1, 4)}`,
        random.chance(0.05) ? dmyDay(-random.int(0, 40)) : isoDay(-random.int(0, 40)),
        random.pick(CLINICS),
        String(random.int(2, 10)),
        String(random.int(2, 55)),
        random.pick(COMMENTS),
      ]),
    },
    { placeholder: { columns: ['wait_minutes'], rate: 0.02 } },
    random,
  );
}

/** Meridian Clinics: appointments, lab summaries and stock across three clinics, and a restricted list of patients to recall. */
export function meridianContent(): CompanyContent {
  return {
    files: [
      { key: 'appointments', name: 'appointments-september.csv', format: 'csv', table: appointments(), uploader: 0 },
      { key: 'labs', name: 'lab-results-summary.csv', format: 'csv', table: labResults(), uploader: 1 },
      { key: 'rota', name: 'staff-rota.xlsx', format: 'xlsx', table: staffRota(), uploader: 'admin' },
      { key: 'suppliers', name: 'supplier-invoices.csv', format: 'csv', table: supplierInvoices(), uploader: 2 },
      { key: 'recalls', name: 'patient-recalls.csv', format: 'csv', table: patientRecalls(), uploader: 'admin', access: { visibility: 'restricted', grantedTo: [0, 1] } },
      { key: 'consumables', name: 'consumables-stock.csv', format: 'csv', table: consumables(1), uploader: 3 },
      { key: 'equipment', name: 'equipment-register.xlsx', format: 'xlsx', table: equipmentRegister(), uploader: 4 },
      { key: 'survey', name: 'patient-satisfaction.csv', format: 'csv', table: satisfactionSurvey(), uploader: 5 },
    ],
    versions: [{ of: 'consumables', name: 'consumables-stock.csv', format: 'csv', table: consumables(2), uploader: 3 }],
    keyColumns: { consumables: ['sku'], appointments: ['appointment_id'] },
    rules: [
      { name: 'Appointment ids are unique', kind: 'unique', columnName: 'appointment_id', severity: 'error' },
      { name: 'Insurer is filled in', kind: 'max_null_percent', columnName: 'insurer', params: { max: 1 }, severity: 'warning' },
      { name: 'Duration is a number', kind: 'type_is', columnName: 'duration_min', params: { type: 'integer' }, severity: 'error' },
      { name: 'No repeated rows', kind: 'max_duplicate_rows', params: { max: 0 }, severity: 'warning' },
      { name: 'No personal data outside the restricted files', kind: 'no_sensitive_data', severity: 'error' },
      { name: 'NPS is at most 10', kind: 'max_value', columnName: 'nps_score', params: { max: 10 }, severity: 'error' },
    ],
    clean: {
      file: 'survey',
      recipe: { steps: [{ step: 'trim_whitespace' }, { step: 'standardise_dates', column: 'submitted_on', order: 'dmy' }, { step: 'replace_values', column: 'wait_minutes', values: ['N/A'] }] },
    },
    comments: [
      { file: 'appointments', author: 0, body: 'No-shows in Hamburg are up again this month. Can we look at it by clinician?', mentions: [1] },
      { file: 'appointments', author: 1, body: 'Yes, I will pull the numbers by clinician before Thursday.', replyTo: 0 },
      { file: 'consumables', author: 3, body: 'Second count is in: gloves in München are well under the minimum level.', mentions: [0, 4] },
      { file: 'equipment', author: 4, body: 'The autoclave in Altona is due for calibration next month.' },
      { file: 'survey', author: 5, body: 'Free-text comments are mixed German and English. Fine for now.' },
    ],
    asks: [
      { file: 'appointments', question: 'How many appointments per clinic, and how many were no-shows?' },
      { file: 'survey', question: 'Average wait in minutes by clinic' },
    ],
    explores: [
      { file: 'appointments', query: { groupBy: ['clinic', 'status'], measures: [{ fn: 'count' }], sort: { by: 'group', index: 0, direction: 'asc' } } },
      { file: 'suppliers', query: { groupBy: ['supplier'], measures: [{ fn: 'sum', column: 'total_eur' }], sort: { by: 'measure', index: 0, direction: 'desc' } } },
    ],
  };
}
