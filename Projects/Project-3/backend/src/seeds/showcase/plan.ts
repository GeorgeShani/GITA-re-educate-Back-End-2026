import type { CompanyIndustry } from '#/database/entities/company.entity.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';
import { kavkasiaContent } from './data/kavkasia.js';
import { meridianContent } from './data/meridian.js';
import { northwindContent } from './data/northwind.js';
import type { CompanyContent } from './data/types.js';

export interface ShowcaseCompany {
  slug: 'northwind' | 'meridian' | 'kavkasia';
  name: string;
  country: string;
  industry: CompanyIndustry;
  /** The plan the company ends up on. A paid one is reached through a real Stripe Checkout, never written to the database. */
  targetPlan: Plan;
  admin: { fullName: string };
  /** Active employees, in roster order (the position is what the content refers to). `removed` ones are removed again at the end. */
  employees: Array<{ fullName: string; removed?: true }>;
  /** Someone invited through the API, so a real invitation email goes out and the person stays `invited`. */
  invitee?: { fullName: string };
  content: () => CompanyContent;
}

export const SHOWCASE: readonly ShowcaseCompany[] = [
  {
    slug: 'northwind',
    name: 'Northwind Logistics',
    country: 'GE',
    industry: 'logistics',
    targetPlan: 'basic',
    admin: { fullName: 'Nino Beridze' },
    employees: [
      { fullName: 'Giorgi Kapanadze' },
      { fullName: 'Mariam Chkheidze' },
      { fullName: 'Levan Gelashvili' },
      { fullName: 'Tamar Japaridze' },
      { fullName: 'Davit Lomidze' },
      { fullName: 'Salome Khutsishvili' },
      { fullName: 'Nika Tsereteli', removed: true },
    ],
    invitee: { fullName: 'Irakli Mgaloblishvili' },
    content: northwindContent,
  },
  {
    slug: 'meridian',
    name: 'Meridian Clinics',
    country: 'DE',
    industry: 'healthcare',
    targetPlan: 'premium',
    admin: { fullName: 'Anna Keller' },
    employees: [
      { fullName: 'Lukas Brandt' },
      { fullName: 'Sophie Wagner' },
      { fullName: 'Jonas Hartmann' },
      { fullName: 'Lea Schneider' },
      { fullName: 'Felix Neumann' },
      { fullName: 'Mara Vogel' },
      { fullName: 'Tobias Richter' },
    ],
    content: meridianContent,
  },
  {
    slug: 'kavkasia',
    name: 'Kavkasia Retail',
    country: 'GE',
    industry: 'e-commerce',
    targetPlan: 'free',
    admin: { fullName: 'Ketevan Maisuradze' },
    employees: [],
    content: kavkasiaContent,
  },
];

/** `you+northwind-nino@gmail.com`: a distinct login per person, all delivered to one mailbox. */
export function addressFor(mailbox: string, slug: string, label: string): string {
  const at = mailbox.lastIndexOf('@');
  if (at < 1 || mailbox.includes('+')) throw new Error('--mailbox must be a plain address like you@gmail.com (no "+" part)');
  const first = label.split(' ')[0] ?? label;
  const clean = first.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${mailbox.slice(0, at)}+${slug}-${clean}${mailbox.slice(at)}`;
}

export const billingAddressFor = (mailbox: string, slug: string): string => addressFor(mailbox, slug, 'billing');
