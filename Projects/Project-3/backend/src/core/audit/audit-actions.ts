/**
 * Every action the audit log can record, in one list.
 *
 * `AuditLogEntry.action` is plain text in the database (an enum would cost a migration
 * per feature), so THIS list is what keeps it a closed vocabulary: `AuditService.record`
 * only accepts an `AuditAction`, so an unregistered action does not compile, and
 * `audit-actions.spec.ts` fails if an action here is never emitted anywhere (a registry
 * entry with no code behind it) or if source emits a string not listed here.
 * `audit.coverage.integration.spec.ts` then drives every flow and asserts each of these
 * really lands in the log — which is what notices a state-changing path that forgot to audit.
 *
 * Dotted, past tense, `<area>.<what happened>`.
 */
export const AUDIT_ACTIONS = [
  // Companies and accounts
  'company.registered',
  'company.activated',
  'company.activation_resent',
  'company.updated',
  'user.profile_updated',
  // Credentials and linked sign-in methods
  'auth.password_reset_requested',
  'auth.password_reset',
  'auth.password_changed',
  'auth.identity_linked',
  'auth.identity_unlinked',
  // Employees
  'employee.invited',
  'employee.invite_resent',
  'employee.accepted_invite',
  'employee.disabled',
  'employee.reactivated',
  // Plans and billing
  'subscription.created',
  'subscription.changed',
  'billing.invoice_finalized',
  // API keys
  'api_key.created',
  'api_key.revoked',
  // Files
  'file.uploaded',
  'file.access_changed',
  'file.deleted',
  // Data-quality rules and reports
  'quality_rule.created',
  'quality_rule.updated',
  'quality_rule.deleted',
  'report.rebuild_requested',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return AUDIT_ACTIONS.some((action) => action === value);
}
