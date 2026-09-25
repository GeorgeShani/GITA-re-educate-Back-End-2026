import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { openPeriodAt } from '#/billing/period.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';

/** Known credentials, on purpose: this company exists so a developer can sign in without going through email. */
export const FIXTURE = {
  company: { name: 'Fixture Co', billingEmail: 'billing@fixture.gridline.test', country: 'GE', industry: 'technology' },
  password: 'Fixture-Password-1!',
  admin: { email: 'admin@fixture.gridline.test', fullName: 'Fixture Admin' },
  employees: [
    { email: 'ada@fixture.gridline.test', fullName: 'Ada Fixture' },
    { email: 'grace@fixture.gridline.test', fullName: 'Grace Fixture' },
  ],
} as const;

export interface FixtureSeedResult {
  created: boolean;
  companyId: string;
}

/**
 * A plain, ordinary company (not the demo: it is writable) with an admin and two employees you can
 * sign in as, on the Basic plan. For local development and manual testing of anything the read-only
 * demo cannot do.
 *
 * Because its password is public, it REFUSES to run in production. Idempotent: the unique billing
 * address settles a second (or concurrent) run, and it reports `created: false`.
 */
@Injectable()
export class FixtureSeedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async seed(): Promise<FixtureSeedResult> {
    if (this.config.isProduction) {
      throw new Error('The fixture company has a published password; it is never seeded in production.');
    }
    const existing = await this.dataSource.getRepository(Company).findOne({ where: { billingEmail: FIXTURE.company.billingEmail } });
    if (existing) return { created: false, companyId: existing.id };

    // Hashing is slow on purpose: do it before opening the transaction.
    const passwordHash = await this.hasher.hash(FIXTURE.password);

    try {
      const companyId = await this.dataSource.transaction((manager) => this.write(manager, passwordHash));
      return { created: true, companyId };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.dataSource.getRepository(Company).findOneOrFail({ where: { billingEmail: FIXTURE.company.billingEmail } });
        return { created: false, companyId: winner.id };
      }
      throw error;
    }
  }

  private async write(manager: EntityManager, passwordHash: string): Promise<string> {
    const now = this.clock.now();
    const company = await manager.save(
      manager.create(Company, { ...FIXTURE.company, status: 'active', activatedAt: now, isDemo: false }),
    );
    const companyId = company.id;

    const people = [
      { ...FIXTURE.admin, role: 'admin' as const },
      ...FIXTURE.employees.map((person) => ({ ...person, role: 'employee' as const })),
    ];
    for (const person of people) {
      const user = await manager.save(
        manager.create(User, { companyId, ...person, status: 'active', activatedAt: now, disabledAt: null }),
      );
      await manager.insert(AuthIdentity, {
        userId: user.id,
        provider: 'password',
        providerUserId: user.id,
        email: person.email,
        emailVerified: true,
        passwordHash,
        lastUsedAt: null,
      });
      if (person.role === 'employee') {
        await manager.insert(SeatInterval, { companyId, userId: user.id, activeFrom: now, activeTo: null });
      }
    }

    const { period, anchorDay } = openPeriodAt(now);
    await manager.save(
      manager.create(Subscription, {
        companyId,
        plan: 'basic',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        billingAnchorDay: anchorDay,
      }),
    );
    await manager.insert(SubscriptionChange, { companyId, fromPlan: null, toPlan: 'basic', effectiveAt: now, prorationCents: 0 });
    return companyId;
  }
}
