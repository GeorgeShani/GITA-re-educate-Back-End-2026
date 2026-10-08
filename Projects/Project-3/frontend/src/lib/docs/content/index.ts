import type { Block } from "../blocks";
import { AI_TOOLS } from "./ai-tools";
import {
  API_KEYS,
  AUTHENTICATION,
  ERRORS,
  IDEMPOTENCY,
  PAGINATION,
  RATE_LIMITS,
} from "./api-basics";
import { COMPANY_API, FILES_API, RULES_API, TEAM_API } from "./api-resources";
import { CLEANING } from "./guides-clean";
import { ACCOUNT, ANALYTICS, AUDIT_LOG, BILLING, DEMO } from "./guides-company";
import { EXPLORE } from "./guides-explore";
import { FILES, REPORTS, VERSIONS } from "./guides-files";
import { ACCESS, RULES } from "./guides-quality";
import { COMMENTS, NOTIFICATIONS, PEOPLE } from "./guides-team";
import { GRAPHQL, MCP, REALTIME, WEBHOOKS } from "./integrations";
import { LIMITS, SECURITY, TROUBLESHOOTING } from "./reference";
import { API_QUICKSTART, CONCEPTS, QUICKSTART } from "./start";

/**
 * The written guides, by slug. The docs home ("") is drawn from the registry itself, so it has no entry here. A slug that
 * is registered but missing from this map shows as "still being written": nothing pretends a guide exists before it does.
 */
export const DOC_BODIES: Readonly<Record<string, readonly Block[]>> = {
  quickstart: QUICKSTART,
  "api-quickstart": API_QUICKSTART,
  concepts: CONCEPTS,
  files: FILES,
  versions: VERSIONS,
  reports: REPORTS,
  cleaning: CLEANING,
  explore: EXPLORE,
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
  "files-api": FILES_API,
  "rules-api": RULES_API,
  "team-api": TEAM_API,
  "company-api": COMPANY_API,
  errors: ERRORS,
  pagination: PAGINATION,
  idempotency: IDEMPOTENCY,
  "rate-limits": RATE_LIMITS,
  webhooks: WEBHOOKS,
  realtime: REALTIME,
  graphql: GRAPHQL,
  mcp: MCP,
  "ai-tools": AI_TOOLS,
  limits: LIMITS,
  security: SECURITY,
  troubleshooting: TROUBLESHOOTING,
};
