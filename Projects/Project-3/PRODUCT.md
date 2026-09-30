# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: operations and finance people at small and mid-sized companies.** They handle payroll exports, inventory counts,
CRM dumps and vendor price lists. Every day they send CSV and Excel files between teams and outside partners. Their problems are
concrete:

- a file arrives broken (blank columns, mixed types, duplicated rows) and nobody notices until a report is wrong;
- nobody knows which copy is the latest;
- a sensitive sheet is shared with the whole company when it should reach two people.

They are not engineers. They judge a tool by how quickly they can tell whether a file is fine and who can see it.

**Secondary: the technical lead.** This is a data, BI or engineering person in the same company who connects Gridline to other
systems through API keys, signed outgoing webhooks and the read-only GraphQL API. They also set the data-quality rules that every
upload is held to.

**Within a company**, admins run the account: plan, billing, people, rules, API keys, webhooks and the audit log. Employees
upload, share, review and comment on files. A person belongs to exactly one company, which is the tenant.

## Product Purpose

Gridline is where a company's spreadsheets live: uploaded, permissioned per person, profiled for data quality, versioned, and
billed by seat and volume. It exists so that a spreadsheet stops being an unknown attachment and becomes a file whose quality,
history and audience are known the moment it lands.

Success means:
- an operations person uploads a file and within seconds knows whether it is good, what changed since the last version, and exactly
  who can open it;
- a technical lead is told automatically, without polling, when something needs attention.

## Positioning

Gridline's claim is the combination. No neighbouring product truthfully covers all of it for the same file:

- **Checked on arrival.** Every upload is profiled automatically: missing values, mixed types, duplicates, a quality score, and the
  company's own rules. An optional AI summary is built from aggregate statistics only.
- **Permissioned per person.** A file is visible company-wide or restricted to named colleagues. A file someone may not see is
  invisible (404), never merely forbidden. Every change is written to an immutable audit log.
- **Versions and change detection.** A new upload of a dataset becomes its next version. Versions are compared automatically, and a
  removed or retyped column raises an alert.
- **Programmable.** Personal API keys with scopes, HMAC-signed outgoing webhooks, a read-only GraphQL API and live Socket.IO updates.

The comparison set is:
- spreadsheet tools (Excel/Google Sheets);
- Airtable and Smartsheet;
- data-quality tools (Great Expectations-style);
- file storage (Box/Dropbox).

Storage tools store without judging the contents. Data-quality tools judge without being where people share files. Spreadsheet and
database tools edit data but do not check each incoming file against rules or keep a per-person, audited trail of who received it.

## Operating Context

- **Daily loop:** upload a CSV/XLS/XLSX (up to 25 MB), wait seconds for the live report status, read the score and any rule
  failures, share or restrict the file, comment and @mention a colleague, upload the next version and compare it.
- **Periodic:**
  - admins invite people;
  - admins watch the quota meter and the running bill;
  - admins read invoices, manage the plan through Stripe Checkout and the customer portal, and review the audit log and usage
    analytics.
- **Notifications and email:** an in-app inbox (quota thresholds, report ready/failed, rule failures, schema changes, mentions,
  replies, shares, invoices) plus transactional email (activation, invitations, password reset, invoices, payment failure and
  recovery, quota alerts).
- **Developer loop:**
  - create an API key;
  - read the Scalar reference at `/reference`;
  - register a webhook endpoint and verify its signatures;
  - query GraphQL.
- **Evaluation:** a read-only demo company can be entered from the public site without signing up.

## Capabilities and Constraints

- **Plans:**
  - Free: 10 files per period, no employees.
  - Basic: 100 files, up to 10 employees at $5 per employee per month.
  - Premium: $300 per month with 1000 files included, then $0.50 per file.
  - Limits by plan: rate limits of 30/120/600 requests per minute; quality rules 3/25/unlimited; versions per dataset
    5/50/unlimited; webhook endpoints.
  - Prices and limits are served by `GET /subscriptions/plans` and must never be hard-coded in UI or copy.
- **Billing:** paid plans are collected by Stripe (Checkout, proration, seat quantity, metered overage, dunning with a grace period,
  then suspension). A suspended company can still reach billing to recover.
- **Sign-in:** email and password or Google, on a provider-agnostic identity model. Accounts can be linked and unlinked, but the last
  identity cannot be removed. An invitation link is the proof of identity.
- **File types** are decided from the bytes, never the file name. Legacy `.xls` files are stored and downloadable but not profiled.
  A preview shows the first 50 rows × 50 columns.
- **The AI summary** sees aggregates only, never a cell value. It is optional (it can be turned off).
- **Terminology:**
  - company (the tenant);
  - admin / employee;
  - file, version and dataset;
  - data-quality report, quality score and rule (severity: error or warning);
  - seat;
  - period (the billing cycle, anchored to the activation day);
  - quota;
  - API key (scopes: `files:read`, `files:write`, `billing:read`);
  - webhook endpoint and delivery.
- **Known limits, stated honestly:**
  - realtime and rate limiting run on a single instance;
  - there is no company deletion or data export yet;
  - a crash mid-upload can orphan a stored object.

## Brand Commitments

- **Name:** Gridline, binding.
- **Logo idea:** a 2×2 grid glyph with one cell filled, standing for the one restricted cell. This is binding as a concept; its
  drawing and colour are decided in the visual direction.
- **Voice:** plain, precise and calm. No hype and no exclamation marks. Numbers beat adjectives, and every claim is a real
  capability.

## Evidence on Hand

- **Real product facts:** everything in `backend/docs/OVERVIEW.md` and the generated `backend/docs/openapi.yaml`, plus a seeded
  read-only demo company (`npm run seed:demo`: a Basic plan, four people, six CSVs with real reports, three quality rules and a
  finalized invoice).
- **Absent, and must not be fabricated:**
  - customers, logos, testimonials, case studies, press;
  - usage or performance numbers, uptime figures, benchmarks;
  - security certifications (no SOC 2, ISO, etc.).

  Competitor comparisons must be factual, qualitative and dated.

## Product Principles

1. **Know the file before you use it.** Quality, history and audience are shown first, not buried.
2. **Invisible, not forbidden.** Access is explicit and per person, and what someone may not see does not exist for them.
3. **Honest numbers.** Prices, quotas, bills and scores come from the system of record, are exact to the cent, and are never
   decorative.
4. **Quiet until it matters.** Alerts, colour and motion are reserved for states that need action: quota thresholds, failing rules,
   schema changes, payment problems.
5. **One product, every surface.** The marketing site, app, emails and API reference speak with one voice.

## Accessibility & Inclusion

- WCAG 2.2 AA in both light and dark themes;
- full keyboard operation with visible focus;
- `prefers-reduced-motion` respected;
- status is never conveyed by colour alone (scores, quota states, rule severities);
- layouts work from 320 px wide.
