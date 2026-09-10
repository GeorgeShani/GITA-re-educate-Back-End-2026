import { Role } from '../../src/common/enums/role.enum';

export interface AddressSeed {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  isDefault: boolean;
}

export interface UserSeed {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  emailVerified: boolean;
  addresses: AddressSeed[];
}

/**
 * Every account here shares the same password (TEST_PASSWORD, below) —
 * this is seed data for local/dev testing, never run against a
 * production database. One of each staff role (admin-roles.constant.ts's
 * four buckets: catalog/commerce/money split ADMIN+MANAGER/ADMIN+SUPPORT,
 * content is ADMIN+EDITOR, people is ADMIN-only) so every admin area is
 * actually reachable without promote-admin.ts, plus a handful of
 * customers with real-shaped address books for testing checkout,
 * account pages, and admin's customer-facing views.
 */
export const TEST_PASSWORD = 'Password123!';

export const STAFF_SEEDS: UserSeed[] = [
  {
    firstName: 'Ava',
    lastName: 'Whitfield',
    email: 'admin@3legantgolf.com',
    phone: '+1-415-555-0101',
    role: Role.ADMIN,
    emailVerified: true,
    addresses: [],
  },
  {
    firstName: 'Marcus',
    lastName: 'Delgado',
    email: 'manager@3legantgolf.com',
    phone: '+1-415-555-0102',
    role: Role.MANAGER,
    emailVerified: true,
    addresses: [],
  },
  {
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'support@3legantgolf.com',
    phone: '+1-415-555-0103',
    role: Role.SUPPORT,
    emailVerified: true,
    addresses: [],
  },
  {
    firstName: 'Theo',
    lastName: 'Bergman',
    email: 'editor@3legantgolf.com',
    phone: '+1-415-555-0104',
    role: Role.EDITOR,
    emailVerified: true,
    addresses: [],
  },
];

export const CUSTOMER_SEEDS: UserSeed[] = [
  {
    firstName: 'James',
    lastName: 'Whitaker',
    email: 'james.whitaker@example.com',
    phone: '+1-312-555-0111',
    role: Role.CUSTOMER,
    emailVerified: true,
    addresses: [
      {
        fullName: 'James Whitaker',
        line1: '482 Lakeshore Drive',
        city: 'Chicago',
        region: 'IL',
        postalCode: '60611',
        countryCode: 'US',
        phone: '+1-312-555-0111',
        isDefault: true,
      },
    ],
  },
  {
    firstName: 'Sofia',
    lastName: 'Marchetti',
    email: 'sofia.marchetti@example.com',
    phone: '+1-646-555-0122',
    role: Role.CUSTOMER,
    emailVerified: true,
    addresses: [
      {
        fullName: 'Sofia Marchetti',
        line1: '210 East 63rd Street',
        line2: 'Apt 14B',
        city: 'New York',
        region: 'NY',
        postalCode: '10065',
        countryCode: 'US',
        phone: '+1-646-555-0122',
        isDefault: true,
      },
      {
        fullName: 'Sofia Marchetti',
        line1: '19 Harbor View Lane',
        city: 'East Hampton',
        region: 'NY',
        postalCode: '11937',
        countryCode: 'US',
        isDefault: false,
      },
    ],
  },
  {
    firstName: 'Liam',
    lastName: 'O’Connell',
    email: 'liam.oconnell@example.com',
    phone: '+44-20-7946-0958',
    role: Role.CUSTOMER,
    emailVerified: true,
    addresses: [
      {
        fullName: 'Liam O’Connell',
        line1: '14 Kensington Court',
        city: 'London',
        postalCode: 'W8 5DL',
        countryCode: 'GB',
        phone: '+44-20-7946-0958',
        isDefault: true,
      },
    ],
  },
  {
    firstName: 'Hannah',
    lastName: 'Kim',
    email: 'hannah.kim@example.com',
    phone: '+1-650-555-0177',
    role: Role.CUSTOMER,
    emailVerified: true,
    addresses: [
      {
        fullName: 'Hannah Kim',
        line1: '3350 El Camino Real',
        city: 'Palo Alto',
        region: 'CA',
        postalCode: '94306',
        countryCode: 'US',
        phone: '+1-650-555-0177',
        isDefault: true,
      },
    ],
  },
  {
    firstName: 'Diego',
    lastName: 'Fernandez',
    email: 'diego.fernandez@example.com',
    phone: '+1-786-555-0133',
    role: Role.CUSTOMER,
    emailVerified: false,
    addresses: [
      {
        fullName: 'Diego Fernandez',
        line1: '900 Brickell Bay Drive',
        line2: 'Unit 2708',
        city: 'Miami',
        region: 'FL',
        postalCode: '33131',
        countryCode: 'US',
        phone: '+1-786-555-0133',
        isDefault: true,
      },
    ],
  },
  {
    firstName: 'Charlotte',
    lastName: 'Bennett',
    email: 'charlotte.bennett@example.com',
    phone: '+1-604-555-0144',
    role: Role.CUSTOMER,
    emailVerified: true,
    addresses: [
      {
        fullName: 'Charlotte Bennett',
        line1: '77 Pinehurst Crescent',
        city: 'Vancouver',
        region: 'BC',
        postalCode: 'V6C 2X8',
        countryCode: 'CA',
        phone: '+1-604-555-0144',
        isDefault: true,
      },
    ],
  },
];

export const ALL_USER_SEEDS: UserSeed[] = [...STAFF_SEEDS, ...CUSTOMER_SEEDS];
