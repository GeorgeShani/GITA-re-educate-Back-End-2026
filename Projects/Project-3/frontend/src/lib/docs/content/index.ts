import type { Block } from "../blocks";
import { ACCOUNT, AUDIT_LOG, DEMO } from "./account";
import {
  API_KEYS,
  AUTHENTICATION,
  ERRORS,
  IDEMPOTENCY,
  PAGINATION,
  RATE_LIMITS,
} from "./api-basics";
import { COMMENTS, NOTIFICATIONS, PEOPLE } from "./collaboration";
import { ANALYTICS, BILLING } from "./company";
import { FILES, VERSIONS } from "./files";
import { GRAPHQL, MCP, REALTIME, WEBHOOKS } from "./integrations";
import { ACCESS, REPORTS, RULES } from "./quality";
import { LIMITS, SECURITY, TROUBLESHOOTING } from "./reference";
import { CONCEPTS, QUICKSTART } from "./start";

/**
 * The written guides, by slug. The docs home ("") is drawn from the registry itself, so it has no entry here. A slug that
 * is registered but missing from this map shows as "still being written": nothing pretends a guide exists before it does.
 */
export const DOC_BODIES: Readonly<Record<string, readonly Block[]>> = {
  quickstart: QUICKSTART,
  concepts: CONCEPTS,
  files: FILES,
  versions: VERSIONS,
  reports: REPORTS,
  rules: RULES,
  access: ACCESS,
  comments: COMMENTS,
  notifications: NOTIFICATIONS,
  people: PEOPLE,
  billing: BILLING,
  analytics: ANALYTICS,
  "audit-log": AUDIT_LOG,
  account: ACCOUNT,
  demo: DEMO,
  authentication: AUTHENTICATION,
  "api-keys": API_KEYS,
  errors: ERRORS,
  pagination: PAGINATION,
  idempotency: IDEMPOTENCY,
  "rate-limits": RATE_LIMITS,
  webhooks: WEBHOOKS,
  realtime: REALTIME,
  graphql: GRAPHQL,
  mcp: MCP,
  limits: LIMITS,
  security: SECURITY,
  troubleshooting: TROUBLESHOOTING,
};
