import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness } from '#test/support/app-harness.js';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK } from '#/core/clock/clock.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { DemoSeedService } from '#/demo/demo-seed.service.js';
import { FIXTURE, FixtureSeedService } from './fixture-seed.service.js';

describe('seeds (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  const fixture = () => new FixtureSeedService(h.dataSource, new PasswordHasher(), h.app.get(APP_CONFIG), h.app.get(CLOCK));

  describe('the fixture company', () => {
    it('seeds a company you can actually sign in to, on the Basic plan, with real seats', async () => {
      const result = await fixture().seed();
      expect(result.created).toBe(true);

      const admin = await h.login(FIXTURE.admin.email, FIXTURE.password);
      const me = await h.http().get('/auth/me').set(...h.bearer(admin)).expect(200);
      expect(me.body.company).toMatchObject({ name: FIXTURE.company.name, status: 'active' });
      expect(me.body.user.role).toBe('admin');

      const subscription = await h.http().get('/subscriptions/me').set(...h.bearer(admin)).expect(200);
      expect(subscription.body).toMatchObject({ plan: 'basic', usage: { employees: 2, seats: 3 } });

      const employee = await h.login(FIXTURE.employees[0].email, FIXTURE.password);
      await h.http().get('/employees').set(...h.bearer(employee)).expect(403);

      // It is an ordinary, WRITABLE company (the demo is the read-only one).
      await h.upload(admin).expect(201);
      expect((await h.dataSource.getRepository(Company).findOneByOrFail({ id: result.companyId })).isDemo).toBe(false);
    });

    it('is idempotent, including under a race', async () => {
      const first = await fixture().seed();
      const [second, third] = await Promise.all([fixture().seed(), fixture().seed()]);

      expect(second).toEqual({ created: false, companyId: first.companyId });
      expect(third).toEqual({ created: false, companyId: first.companyId });
      expect(await h.dataSource.getRepository(User).countBy({ companyId: first.companyId })).toBe(3);
    });

    it('a race between two FIRST runs still ends with exactly one company', async () => {
      const results = await Promise.all([fixture().seed(), fixture().seed()]);
      expect(results.filter((result) => result.created)).toHaveLength(1);
      expect(await h.dataSource.getRepository(Company).countBy({ billingEmail: FIXTURE.company.billingEmail })).toBe(1);
    });

    it('refuses to run in production: its password is public', async () => {
      const production = { ...h.app.get(APP_CONFIG), isProduction: true };
      const service = new FixtureSeedService(h.dataSource, new PasswordHasher(), production, h.app.get(CLOCK));

      await expect(service.seed()).rejects.toThrow(/production/);
      expect(await h.dataSource.getRepository(Company).countBy({ billingEmail: FIXTURE.company.billingEmail })).toBe(0);
    });
  });

  describe('seed:all', () => {
    it('both companies coexist, independently: neither seed disturbs the other', async () => {
      const demo = await h.app.get(DemoSeedService).seed();
      const plain = await fixture().seed();

      expect(demo.companyId).not.toBe(plain.companyId);
      expect(await h.dataSource.getRepository(Company).count()).toBe(2);
      expect((await h.dataSource.getRepository(Company).findOneByOrFail({ id: demo.companyId })).isDemo).toBe(true);

      // Signing in to the fixture is unaffected by the demo, and the demo login still picks the demo.
      const admin = await h.login(FIXTURE.admin.email, FIXTURE.password);
      expect((await h.http().get('/auth/me').set(...h.bearer(admin)).expect(200)).body.company.isDemo).toBe(false);
      const session = h.parseSession((await h.http().post('/auth/demo').expect(200)).body);
      const demoMe = (await h.http().get('/auth/me').set(...h.bearer(session)).expect(200)).body;
      expect(demoMe.company).toMatchObject({ isDemo: true, name: expect.stringMatching(/Demo/) });
    });
  });
});
