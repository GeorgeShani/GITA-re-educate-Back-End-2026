import { type Block, p, section } from "../blocks";
import { ACCOUNT_REF, AUDIT_LOG_REF } from "./api-account";
import { ANALYTICS_REF, BILLING_REF } from "./api-billing";
import { FILES_REF, VERSIONS_REF } from "./api-files";
import { ACCESS_REF, REPORTS_REF, RULES_REF } from "./api-quality";
import { COMMENTS_REF, NOTIFICATIONS_REF, PEOPLE_REF } from "./api-team";

/**
 * The calls behind the dashboard, grouped the way a developer looks for them. The dashboard guides explain the ideas in
 * plain words; these pages are the same features as requests. Each piece is written once, in its own file, and folded
 * in here.
 */

export const FILES_API: Block[] = [
  p(
    "Everything you can do with files over HTTP: upload, list, download, share, keep versions, compare them and read quality reports. The ideas are explained in the dashboard guides ([Files and uploads](/docs/files), [Versions and comparing](/docs/versions), [Quality reports](/docs/reports), [Sharing and access](/docs/access)). This page is about the calls.",
  ),
  ...section("Upload, list and download", FILES_REF.slice(1)),
  ...section("Sharing", ACCESS_REF.slice(1)),
  ...section("Versions and comparing", VERSIONS_REF.slice(1)),
  ...section("Quality reports", REPORTS_REF.slice(1)),
];

export const RULES_API: Block[] = [
  p(
    "Quality rules over HTTP. What a rule is, and how to think about errors and warnings, is in the dashboard guide [Quality rules](/docs/rules). Here are the calls and every setting.",
  ),
  ...RULES_REF.slice(1),
];

export const TEAM_API: Block[] = [
  p(
    "The calls behind [Comments and mentions](/docs/comments), [Notifications and alerts](/docs/notifications) and [People](/docs/people).",
  ),
  ...section("Comments", COMMENTS_REF.slice(1)),
  ...section("Notifications", NOTIFICATIONS_REF.slice(1)),
  ...section("People", PEOPLE_REF.slice(1)),
];

export const COMPANY_API: Block[] = [
  p(
    "The calls behind [Plans and billing](/docs/billing), [Usage analytics](/docs/analytics), [The audit log](/docs/audit-log) and [Your account and company](/docs/account).",
  ),
  ...section("Plans and billing", BILLING_REF.slice(1)),
  ...section("Usage analytics", ANALYTICS_REF.slice(1)),
  ...section("The audit log", AUDIT_LOG_REF.slice(1)),
  ...section("Account and company", ACCOUNT_REF.slice(1)),
];
