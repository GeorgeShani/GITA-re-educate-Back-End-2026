import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, DEFAULT_PASSWORD } from '#test/support/app-harness.js';
import { BillingCycleService } from '#/billing/cycle/billing-cycle.service.js';
import { AUDIT_ACTIONS } from './audit-actions.js';

/**
 * `audit-actions.spec.ts` proves the registry and the code agree on WHICH actions exist.
 * This proves each one is really WRITTEN: it drives every state-changing flow of the app
 * once and asserts that every registered action landed in the log. A flow that stopped
 * auditing — or a new action nobody exercised — fails here by name.
 */
describe('audit coverage (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  async function recordedActions(): Promise<Set<string>> {
    const rows: Array<{ action: string }> = await h.dataSource.query('SELECT DISTINCT action FROM audit_log_entry');
    return new Set(rows.map((row) => row.action));
  }

  it('every registered action is written by some flow', async () => {
    const NEW_PASSWORD = 'brand-new-password-1';
    const NEWER_PASSWORD = 'another-password-2';

    // Registration and activation.
    const admin = await h.registerAndActivate();
    let session = await h.login(admin.email);
    await h.subscribe(session, 'basic');

    // A company that never activates, to resend the activation link for.
    await h
      .http()
      .post('/auth/register-company')
      .send({ companyName: 'Pending Co', email: 'pending@acme.test', password: DEFAULT_PASSWORD, country: 'GE', industry: 'technology' })
      .expect(201);
    await h.drainTasks();
    await h.http().post('/auth/resend-activation').send({ email: 'pending@acme.test' }).expect(200);

    // Profile and company edits.
    await h.http().patch('/users/me').set(...h.bearer(session)).send({ fullName: 'Renamed Admin' }).expect(200);
    await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'Renamed Co' }).expect(200);

    // Credentials: forgot → reset → change.
    await h.http().post('/auth/password/forgot').send({ email: admin.email }).expect(200);
    await h.drainTasks();
    await h
      .http()
      .post('/auth/password/reset')
      .send({ token: h.mail.latestTokenTo(admin.email), newPassword: NEW_PASSWORD })
      .expect(200);
    session = await h.login(admin.email, NEW_PASSWORD);
    await h
      .http()
      .patch('/auth/password')
      .set(...h.bearer(session))
      .send({ currentPassword: NEW_PASSWORD, newPassword: NEWER_PASSWORD })
      .expect(200);
    session = await h.login(admin.email, NEWER_PASSWORD);

    // Employees: invite, resend, accept, remove, bring back.
    const invited = await h.inviteEmployee(session);
    await h.http().post(`/employees/${invited.userId}/resend-invite`).set(...h.bearer(session)).expect(200);
    await h.drainTasks();
    await h
      .http()
      .post('/auth/accept-invite')
      .send({ token: h.mail.latestTokenTo(invited.email), password: DEFAULT_PASSWORD })
      .expect(200);
    await h.http().delete(`/employees/${invited.userId}`).set(...h.bearer(session)).expect(200);
    await h.http().post(`/employees/${invited.userId}/reactivate`).set(...h.bearer(session)).expect(200);

    // API keys: create, revoke.
    const apiKey = await h.createApiKey(session, { scopes: ['files:read'] });
    await h.http().delete(`/api-keys/${apiKey.id}`).set(...h.bearer(session)).expect(200);

    // Files: upload, change who sees it, delete.
    const uploaded = await h.upload(session).expect(201);
    await h.http().patch(`/files/${uploaded.body.id}`).set(...h.bearer(session)).send({ visibility: 'restricted' }).expect(200);
    await h.http().delete(`/files/${uploaded.body.id}`).set(...h.bearer(session)).expect(200);

    // Linked sign-in methods.
    await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'coverage-google' } });
    const identities = (await h.http().get('/auth/identities').set(...h.bearer(session)).expect(200)).body;
    const google = identities.data.find((identity: { provider: string }) => identity.provider === 'google');
    await h.http().delete(`/auth/identities/${google.id}`).set(...h.bearer(session)).expect(200);

    // Billing: a plan change closes the outgoing period, and the cycle rolls the next.
    h.clock.advance(2 * 86_400_000);
    session = await h.login(admin.email, NEWER_PASSWORD);
    await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'premium' }).expect(200);
    h.clock.set(new Date('2026-05-02T00:10:00.000Z'));
    await h.app.get(BillingCycleService).runCycle();

    const recorded = await recordedActions();
    const missing = AUDIT_ACTIONS.filter((action) => !recorded.has(action));

    expect(missing, `registered but never written by any flow: ${missing.join(', ')}`).toEqual([]);
    expect([...recorded].filter((action) => !(AUDIT_ACTIONS as readonly string[]).includes(action))).toEqual([]);
  });
});
