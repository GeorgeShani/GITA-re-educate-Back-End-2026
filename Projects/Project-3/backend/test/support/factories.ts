import type { Repository } from 'typeorm';
import { Company } from '../../src/database/entities/company.entity.js';
import { User } from '../../src/database/entities/user.entity.js';

// Project-2 built test data inline per spec with no shared fixture layer.
// This is the "genuine addition for Project-3" the exploration flagged —
// one named home for the boilerplate, so integration specs read as
// intent (`seedUser(repo, companyId, { role: 'admin' })`) rather than
// re-deriving a valid Company/User shape every time.

let companyCounter = 0;
let userCounter = 0;

export async function seedCompany(
  repo: Repository<Company>,
  overrides: Partial<Company> = {},
): Promise<Company> {
  companyCounter += 1;
  return repo.save(
    repo.create({
      name: `Test Co ${companyCounter}`,
      billingEmail: `billing-${companyCounter}@example.test`,
      country: 'GE',
      industry: 'technology',
      status: 'active',
      ...overrides,
    }),
  );
}

export async function seedUser(
  repo: Repository<User>,
  companyId: string,
  overrides: Partial<User> = {},
): Promise<User> {
  userCounter += 1;
  return repo.save(
    repo.create({
      companyId,
      email: `user-${userCounter}@example.test`,
      fullName: `Test User ${userCounter}`,
      role: 'employee',
      status: 'active',
      ...overrides,
    }),
  );
}
