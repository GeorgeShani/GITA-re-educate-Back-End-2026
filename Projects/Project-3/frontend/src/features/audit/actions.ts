import type { components } from "@/lib/api/schema";

export type AuditAction = components["schemas"]["AuditEntryDto"]["action"];

/**
 * Every action the API can record, said the way a person would say it, grouped by what it is about. The record is
 * exhaustive on purpose: a new action added to the API stops this file from compiling until someone words it.
 */
export const ACTIONS: Record<AuditAction, { label: string; group: string }> = {
  "company.registered": { label: "Company registered", group: "Company" },
  "company.activated": { label: "Company activated", group: "Company" },
  "company.activation_resent": {
    label: "Activation email sent again",
    group: "Company",
  },
  "company.updated": { label: "Company details changed", group: "Company" },
  "user.profile_updated": { label: "Profile changed", group: "People" },
  "auth.password_reset_requested": {
    label: "Password reset requested",
    group: "Sign-in",
  },
  "auth.password_reset": { label: "Password reset", group: "Sign-in" },
  "auth.password_changed": { label: "Password changed", group: "Sign-in" },
  "auth.identity_linked": { label: "Sign-in method added", group: "Sign-in" },
  "auth.identity_unlinked": {
    label: "Sign-in method removed",
    group: "Sign-in",
  },
  "employee.invited": { label: "Employee invited", group: "People" },
  "employee.invite_resent": {
    label: "Invitation sent again",
    group: "People",
  },
  "employee.accepted_invite": {
    label: "Invitation accepted",
    group: "People",
  },
  "employee.disabled": { label: "Employee removed", group: "People" },
  "employee.reactivated": { label: "Employee brought back", group: "People" },
  "subscription.created": { label: "First plan chosen", group: "Billing" },
  "subscription.changed": { label: "Plan changed", group: "Billing" },
  "billing.invoice_finalized": { label: "Invoice issued", group: "Billing" },
  "billing.checkout_started": {
    label: "Checkout started",
    group: "Billing",
  },
  "billing.payment_failed": { label: "Payment failed", group: "Billing" },
  "billing.payment_succeeded": {
    label: "Payment received",
    group: "Billing",
  },
  "billing.company_suspended": {
    label: "Company suspended",
    group: "Billing",
  },
  "billing.company_reactivated": {
    label: "Company reactivated",
    group: "Billing",
  },
  "api_key.created": { label: "API key created", group: "Developers" },
  "api_key.revoked": { label: "API key revoked", group: "Developers" },
  "file.uploaded": { label: "File uploaded", group: "Files" },
  "file.access_changed": { label: "File access changed", group: "Files" },
  "file.deleted": { label: "File deleted", group: "Files" },
  "file.cleaned": { label: "File cleaned", group: "Files" },
  "dataset.settings_updated": {
    label: "File settings saved",
    group: "Files",
  },
  "comment.created": { label: "Comment added", group: "Files" },
  "comment.updated": { label: "Comment edited", group: "Files" },
  "comment.deleted": { label: "Comment deleted", group: "Files" },
  "webhook_endpoint.created": {
    label: "Webhook endpoint added",
    group: "Developers",
  },
  "webhook_endpoint.updated": {
    label: "Webhook endpoint changed",
    group: "Developers",
  },
  "webhook_endpoint.deleted": {
    label: "Webhook endpoint removed",
    group: "Developers",
  },
  "webhook_endpoint.secret_rotated": {
    label: "Webhook secret replaced",
    group: "Developers",
  },
  "webhook_delivery.redelivered": {
    label: "Webhook delivery sent again",
    group: "Developers",
  },
  "quality_rule.created": { label: "Quality rule added", group: "Files" },
  "quality_rule.updated": { label: "Quality rule changed", group: "Files" },
  "quality_rule.deleted": { label: "Quality rule removed", group: "Files" },
  "report.rebuild_requested": {
    label: "Report rebuild requested",
    group: "Files",
  },
};

/** The action's words, or the raw name for one this build has not heard of (a newer API than this page). */
export function actionLabel(action: string): string {
  return isAction(action) ? ACTIONS[action].label : action;
}

export const GROUPS: readonly string[] = [
  ...new Set(Object.values(ACTIONS).map((entry) => entry.group)),
];

export function isAction(value: string | undefined): value is AuditAction {
  return value !== undefined && Object.hasOwn(ACTIONS, value);
}
