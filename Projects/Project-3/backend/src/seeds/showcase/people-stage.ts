import { DataSource } from 'typeorm';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { seatCapProblem } from '#/employees/seat-cap.js';
import { AuditService } from '#/core/audit/audit.service.js';
import type { Clock } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { BillingAccount } from '#/payments/billing-account.entity.js';
import { BillingSyncService } from '#/payments/billing-sync.service.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';
import type { Credentials } from './credentials.js';
import { type ShowcaseCompany, addressFor, billingAddressFor } from './plan.js';

export interface PeopleResult {
  slug: string;
  companyId: string;
  adminId: string;
  /** Roster position (0 is first) → the employee's user id, for everyone in the roster. */
  employeeIds: string[];
  added: number;
  alreadyThere: number;
}

/**
 * What must be true before content goes in: the company exists, and a paid company really is on its plan through Stripe (a
 * Checkout was completed), not merely labelled so. Returns sentences for everything that is not, so the run can stop and say why.
 */
export async function preflightProblems(dataSource: DataSource, spec: ShowcaseCompany, mailbox: string): Promise<string[]> {
  const company = await dataSource.getRepository(Company).findOne({ where: { billingEmail: billingAddressFor(mailbox, spec.slug) } });
  if (!company) return [`${spec.name} does not exist yet. Run --stage accounts first.`];
  const subscription = await dataSource.getRepository(Subscription).findOne({ where: { companyId: company.id } });
  if (subscription?.plan !== spec.targetPlan) {
    return [
      spec.targetPlan === 'free'
        ? `${spec.name} should be on Free, but is on ${subscription?.plan ?? 'no plan'}.`
        : `${spec.name} is on ${subscription?.plan ?? 'no plan'}, not ${spec.targetPlan}. Sign in as its admin and upgrade through Checkout (card 4242 4242 4242 4242), wait for the plan to activate, then run this again.`,
    ];
  }
  if (spec.targetPlan !== 'free') {
    const account = await dataSource.getRepository(BillingAccount).findOne({ where: { companyId: company.id } });
    if (!account?.stripeSubscriptionId) return [`${spec.name} is on ${spec.targetPlan}, but not through a Stripe subscription. Upgrade it through Checkout.`];
  }
  return [];
}

/**
 * The active employees of one company, written straight to the database the way accepting an invitation writes them: the user, a
 * password sign-in, an open seat interval, the audit trail (`employee.invited`, then `employee.accepted_invite`) and, for a company
 * on a Stripe subscription, a seat-count sync, so Stripe's quantity follows. The invitation EMAIL is deliberately not sent: these
 * people are given their passwords directly. (The one person who IS invited gets a real email, through the API, in the content stage.)
 *
 * Each person is one transaction under the subscription row lock, with the plan's seat cap checked first, exactly as inviting
 * does, so the seed can never exceed what the plan allows. Idempotent: someone already in the company is skipped.
 */
export class PeopleStage {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly subscriptions: SubscriptionsService,
    private readonly billingSync: BillingSyncService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async run(spec: ShowcaseCompany, mailbox: string, credentials: Credentials): Promise<PeopleResult> {
    const billingEmail = billingAddressFor(mailbox, spec.slug);
    const company = await this.dataSource.getRepository(Company).findOneOrFail({ where: { billingEmail } });
    const adminEmail = addressFor(mailbox, spec.slug, spec.admin.fullName);
    const admin = await this.dataSource.getRepository(User).findOneOrFail({ where: { companyId: company.id, email: adminEmail } });
    const companyEntry = { slug: spec.slug, name: spec.name, billingEmail, plan: spec.targetPlan };

    const employeeIds: string[] = [];
    let added = 0;
    let alreadyThere = 0;
    for (const person of spec.employees) {
      const email = addressFor(mailbox, spec.slug, person.fullName);
      const existing = await this.dataSource.getRepository(User).findOne({ where: { companyId: company.id, email } });
      if (existing) {
        employeeIds.push(existing.id);
        alreadyThere += 1;
        continue;
      }
      const saved = await credentials.person(companyEntry, { role: 'employee', fullName: person.fullName, email, note: person.removed ? 'removed again at the end of the content stage' : '' });
      const passwordHash = await this.hasher.hash(saved.password);
      employeeIds.push(await this.addOne(company.id, admin.id, { email, fullName: person.fullName, passwordHash }));
      added += 1;
    }
    return { slug: spec.slug, companyId: company.id, adminId: admin.id, employeeIds, added, alreadyThere };
  }

  private async addOne(companyId: string, adminId: string, person: { email: string; fullName: string; passwordHash: string }): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.subscriptions.lockForUpdate(manager, companyId);
      if (!subscription) throw new Error('The company has no subscription.');
      const problem = seatCapProblem(subscription.plan, await this.subscriptions.employeeSeatsHeld(manager, companyId));
      if (problem) throw new Error(`Cannot add ${person.fullName}: ${problem}`);

      const now = this.clock.now();
      const user = await manager.save(
        manager.create(User, { companyId, email: person.email, fullName: person.fullName, role: 'employee', status: 'active', activatedAt: now, disabledAt: null }),
      );
      await manager.insert(AuthIdentity, {
        userId: user.id,
        provider: 'password',
        providerUserId: user.id,
        email: person.email,
        emailVerified: true,
        passwordHash: person.passwordHash,
        lastUsedAt: null,
      });
      await manager.insert(SeatInterval, { companyId, userId: user.id, activeFrom: now, activeTo: null });
      await this.billingSync.recordSeatChange(manager, companyId, now);
      await this.audit.record({ action: 'employee.invited', companyId, actorUserId: adminId, target: { type: 'user', id: user.id }, metadata: { email: user.email } }, manager);
      await this.audit.record({ action: 'employee.accepted_invite', companyId, actorUserId: user.id, target: { type: 'user', id: user.id } }, manager);
      return user.id;
    });
  }
}
