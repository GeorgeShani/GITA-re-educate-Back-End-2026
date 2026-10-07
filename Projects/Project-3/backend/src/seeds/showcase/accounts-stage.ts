import { DataSource, type EntityManager } from 'typeorm';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { openPeriodAt } from '#/billing/period.js';
import type { AppConfig } from '#/config/env.schema.js';
import { AuditService } from '#/core/audit/audit.service.js';
import type { Clock } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import type { Credentials } from './credentials.js';
import { SHOWCASE, type ShowcaseCompany, addressFor, billingAddressFor } from './plan.js';

export interface AccountsResult {
  slug: string;
  companyId: string;
  created: boolean;
}

/**
 * Stage 1: the companies and their administrators, all on the Free plan.
 *
 * A paid plan is never written here. Basic and Premium are reached through a real Stripe Checkout (signed in as the admin), so the
 * customer, subscription, seat item and invoices all exist at Stripe too. Idempotent: a company is found by its billing address,
 * and an existing one is left exactly as it is.
 */
export class AccountsStage {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly config: Pick<AppConfig, 'isProduction'>,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async run(options: { mailbox: string; credentials: Credentials; confirmProduction: boolean; companies?: readonly ShowcaseCompany[] }): Promise<AccountsResult[]> {
    if (this.config.isProduction && !options.confirmProduction) {
      throw new Error('This is a production database. Run again with --confirm-production to create the showcase companies in it.');
    }
    const results: AccountsResult[] = [];
    for (const company of options.companies ?? SHOWCASE) {
      results.push(await this.ensure(company, options.mailbox, options.credentials));
    }
    return results;
  }

  private async ensure(spec: ShowcaseCompany, mailbox: string, credentials: Credentials): Promise<AccountsResult> {
    const billingEmail = billingAddressFor(mailbox, spec.slug);
    const adminEmail = addressFor(mailbox, spec.slug, spec.admin.fullName);

    const existing = await this.dataSource.getRepository(Company).findOne({ where: { billingEmail } });
    if (existing) {
      if (!credentials.find(spec.slug, adminEmail)) {
        throw new Error(`${spec.name} already exists, but ${adminEmail} is not in the credentials file. Point --credentials at the file the first run wrote.`);
      }
      return { slug: spec.slug, companyId: existing.id, created: false };
    }

    // The password is saved to disk BEFORE the account is written, so a crash in between never leaves an account nobody can open.
    const admin = await credentials.person(
      { slug: spec.slug, name: spec.name, billingEmail, plan: spec.targetPlan === 'free' ? 'free' : `free until upgraded to ${spec.targetPlan}` },
      { role: 'admin', fullName: spec.admin.fullName, email: adminEmail, note: spec.targetPlan === 'free' ? '' : `upgrade to ${spec.targetPlan} through Checkout` },
    );
    // Hashing is slow on purpose: do it before the transaction opens.
    const passwordHash = await this.hasher.hash(admin.password);

    try {
      const companyId = await this.dataSource.transaction((manager) => this.write(manager, spec, billingEmail, adminEmail, passwordHash));
      return { slug: spec.slug, companyId, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.dataSource.getRepository(Company).findOneOrFail({ where: { billingEmail } });
        return { slug: spec.slug, companyId: winner.id, created: false };
      }
      throw error;
    }
  }

  private async write(manager: EntityManager, spec: ShowcaseCompany, billingEmail: string, adminEmail: string, passwordHash: string): Promise<string> {
    const now = this.clock.now();
    const company = await manager.save(
      manager.create(Company, { name: spec.name, billingEmail, country: spec.country, industry: spec.industry, status: 'active', activatedAt: now, isDemo: false }),
    );
    const user = await manager.save(
      manager.create(User, { companyId: company.id, email: adminEmail, fullName: spec.admin.fullName, role: 'admin', status: 'active', activatedAt: now, disabledAt: null }),
    );
    await manager.insert(AuthIdentity, {
      userId: user.id,
      provider: 'password',
      providerUserId: user.id,
      email: adminEmail,
      emailVerified: true,
      passwordHash,
      lastUsedAt: null,
    });
    const { period, anchorDay } = openPeriodAt(now);
    await manager.save(
      manager.create(Subscription, { companyId: company.id, plan: 'free', currentPeriodStart: period.start, currentPeriodEnd: period.end, billingAnchorDay: anchorDay }),
    );
    await manager.insert(SubscriptionChange, { companyId: company.id, fromPlan: null, toPlan: 'free', effectiveAt: now, prorationCents: 0 });
    await this.audit.record(
      { action: 'company.activated', companyId: company.id, actorUserId: user.id, target: { type: 'company', id: company.id } },
      manager,
    );
    return company.id;
  }
}
