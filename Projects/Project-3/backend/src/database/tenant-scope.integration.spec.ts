import type { Repository } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCompany, seedUser } from '../../test/support/factories.js';
import { PostgresTestContext } from '../../test/support/postgres-context.js';
import { Company } from './entities/company.entity.js';
import { User } from './entities/user.entity.js';
import { TenantScope } from './tenant-scope.js';

/**
 * Proves the tenant boundary in BOTH directions. Asserting only that
 * `TenantScope` returns the right rows proves nothing about the helper
 * itself — a bug that made it return everything would also "pass" that
 * check if there were only one company in the table. The bare repository
 * query is what proves the scoped query is doing real filtering.
 */
describe('TenantScope (integration)', () => {
  let ctx: PostgresTestContext;
  let companyRepo: Repository<Company>;
  let userRepo: Repository<User>;
  const tenantScope = new TenantScope();

  beforeAll(async () => {
    ctx = await PostgresTestContext.start();
    companyRepo = ctx.dataSource.getRepository(Company);
    userRepo = ctx.dataSource.getRepository(User);
  }, 30_000);

  beforeEach(() => ctx.reset());
  afterAll(() => ctx.stop());

  it('scopes to one company while the bare repository sees every company', async () => {
    const companyA = await seedCompany(companyRepo);
    const companyB = await seedCompany(companyRepo);
    await seedUser(userRepo, companyA.id);
    await seedUser(userRepo, companyA.id);
    await seedUser(userRepo, companyB.id);

    const scoped = await tenantScope.forCompany(userRepo, companyA.id).getMany();
    expect(scoped).toHaveLength(2);
    expect(scoped.every((user) => user.companyId === companyA.id)).toBe(true);

    const unscoped = await userRepo.find();
    expect(unscoped).toHaveLength(3);
  });

  it('returns nothing for a company with no rows, not an error', async () => {
    const company = await seedCompany(companyRepo);

    const result = await tenantScope.forCompany(userRepo, company.id).getMany();

    expect(result).toEqual([]);
  });

  it('composes with further filtering via the alias it establishes', async () => {
    const company = await seedCompany(companyRepo);
    await seedUser(userRepo, company.id, { role: 'admin' });
    await seedUser(userRepo, company.id, { role: 'employee' });

    const admins = await tenantScope
      .forCompany(userRepo, company.id, 'u')
      .andWhere('u.role = :role', { role: 'admin' })
      .getMany();

    expect(admins).toHaveLength(1);
    expect(admins[0]?.role).toBe('admin');
  });
});
