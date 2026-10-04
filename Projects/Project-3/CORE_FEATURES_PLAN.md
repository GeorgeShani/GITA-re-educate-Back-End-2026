# Gridline: four new core features, and a gap sweep

## Why

Today Gridline checks a spreadsheet on arrival: it profiles the file, runs the quality rules, writes an AI narrative, and
compares two versions by their statistics. That tells an analyst **that** a file has a problem. It does not help them **fix**
it, tell them **which rows** changed, warn them that the file is **dangerous to share**, or **answer a question** from it.
Those four jobs fill an analyst's week. Each feature below does one of them, end to end, through the same doorways the
product already has: REST, MCP, webhooks, realtime and the dashboard.

The rules that stay fixed:
- **The AI never sees a cell value.** New AI use sends column names, types and the user's words, nothing else.
- **One access rule.** Every new read goes through `FilesService.requireVisible`.
- **Honest numbers.** Every new figure is computed, and every claim on the marketing site is a real capability.

## The four features

| # | Feature | The analyst's problem | Size |
|---|---|---|---|
| F1 | **Sensitive-data scan** | "Did someone just upload a file full of customer emails and card numbers, shared with the whole company?" | S–M |
| F2 | **Clean** | "The report says 340 duplicates and dates in four formats. Now I fix it by hand in Excel, again, every month." | L |
| F3 | **What changed** (row-level diff) | "v4 arrived. Which customers are new, which left, and whose balance changed?" | M |
| F4 | **Explore and ask** | "What is revenue by region in this file?" without exporting it to another tool. | M–L |

They build on each other:
- F1's masking becomes a step in F2.
- F2 and F3 share one new `dataset_settings` table: F2 stores a dataset's saved recipe there, F3 its key columns.
- F4 reuses the chart parts from Analytics.

### F1. Sensitive-data scan

**What it does**
- While profiling, every column is checked for personal or secret data:
  - email addresses, phone numbers and IP addresses;
  - card numbers (Luhn check) and IBANs (mod-97 check);
  - dates of birth (a date column whose name matches);
  - things that look like secrets (`sk_`, `AKIA…`, JWTs).
- The checks are deterministic (patterns and checksums), never AI.

**What is stored**
- Per column: `{ kind, matchPercent }`. No values are stored.

**How it reaches people**
- Report: a "Sensitive data" block, e.g. "`email` looks like email addresses (98% of values)".
- If such a file is shared with the whole company:
  - a **"Restrict this file"** shortcut that opens the existing share dialog;
  - a notification to the uploader and the admins;
  - a webhook event `file.sensitive_data_found`.
- A new rule kind, `no_sensitive_data` (optionally per kind), so a company can fail files that carry personal data.

**Backend**
- `files/quality/sensitive.ts`: pure detectors that feed the `MetricsAccumulator`.
- `metricsSchema` gains an optional `sensitive` field per column, so old reports still parse.
- Register the rule kind in `ruleSpecSchema` / `evaluateRules`, plus the notification type and the webhook event.

**Frontend**
- A block on the report panel and a stamp on the file row.
- In the files list, a filter "Has sensitive data".

### F2. Clean (fix recipes that produce a new version)

**What it does.** On any profiled file, **Clean** opens a step list, ticked for the problems the report found:
- trim whitespace;
- tidy headers;
- drop empty rows and duplicate rows;
- dates to ISO, with the source format detected;
- numbers from `"1.234,50 €"`-style text;
- replace placeholder values (`N/A`, `-`, `null`) with empty;
- fill empties with a value;
- change case;
- rename or drop columns;
- **mask a column** (redact, hash, or keep the last 4 characters), which comes from F1.

**Dry run.** A dry run shows exactly what would change before anything is written:
- per-step counts ("1,203 cells trimmed, 34 duplicate rows dropped");
- a before/after sample of 20 rows.

**Applying it**
- The result is written as the **next version** of the dataset, in the source's own format.
- The new version records where it came from: "cleaned from v3 with 5 steps".
- The normal report runs on it, so the score before and after shows on the compare page.

**Saved recipes**
- A recipe can be saved for the dataset.
- With **Clean every new version automatically** switched on, the next upload is cleaned without anyone asking.

**Backend**
- `files/cleaning/`:
  - pure steps over a `ParsedSheet`;
  - a Zod recipe schema;
  - `dryRun()` and `apply()`.
- `files/writing/sheet-writer.ts`: CSV via a new `csv-stringify` dependency, XLSX via `exceljs`, which is already installed.
- **The key refactor:**
  - `FilesService.store` reads the uploader from the request (`caller()`), so a background task cannot call it.
  - Extract it to accept an explicit `Actor`. The HTTP path passes `caller()`, and the task passes the person who asked.
- New task type `apply_cleaning_recipe`. It needs the enum migration and the `TASK_HANDLERS` registration (`task-runner.module.ts`).
- `FileAsset` gains two columns: `derivedFromFileId` and `derivation` (jsonb, the recipe snapshot).
- New table `dataset_settings` with `companyId`, `datasetId`, `keyColumns`, `recipe` and `autoClean`, indexed by `companyId`.
- **Routes:**
  - `POST /files/:id/clean/preview`
  - `POST /files/:id/clean`, which answers 202 and accepts an `Idempotency-Key`
  - `GET` and `PUT /datasets/:datasetId/settings`
- **Scope:** `files:write`.
- **Plan limit:** a new `PlanRules.autoClean` (Free off; Basic and Premium on).

**Frontend**
- A **Clean** button in the file header opens a page `/files/[id]/clean` with:
  - the step list, each step showing its count;
  - the live dry-run table;
  - **Create cleaned version**.
- On success it lands on the compare page of the old version against the new one.
- A lineage line on the file page.

### F3. What changed (row-level diff between versions)

**Today's compare** only diffs statistics. This adds the rows.

**Key columns**
- A dataset gets **key columns**, e.g. `customer_id`.
- Gridline suggests them: columns unique and non-empty in both versions. The person confirms.

**What a diff gives**
- Counts:
  - rows added, removed, changed and unchanged;
  - which columns changed most.
- A browsable sample: the first 500 changed rows, with the old value and the new value in each changed cell.
- A downloadable **full diff CSV**, with a `change` column of `added` / `removed` / `changed`.

**When it runs**
- Automatically for every new version once the dataset has a key.
- It produces:
  - a notification, e.g. "v4: 120 added, 3 removed, 57 changed";
  - a webhook `dataset.changed`.
- `dataset.schema_changed` also becomes a webhook event; today it is only a notification.

**Backend**
- `files/diff/row-diff.ts`, pure: a key → row-hash map over both sheets.
- Task type `build_version_diff`.
- Table `version_diff`: `companyId`, `fromFileId`, `toFileId`, `keyColumns`, `summary` jsonb, `sample` jsonb, `status`.
- Routes:
  - `GET /files/:id/compare/:otherId/rows`
  - `GET …/rows.csv`, a signed download
  - `POST …/rows` to run with chosen keys
- Reading requires **both** versions to be visible, the same rule compare uses today.

**Frontend**
- The compare page gains a **Rows** section:
  - a key picker, with the suggestion preselected;
  - count tiles;
  - a table filtered by added / removed / changed, with changed cells highlighted and the old value shown struck through;
  - **Download all changes**.

### F4. Explore and ask

**Explore.** An **Explore** tab on the file page: group by, measures, filters and sort, computed by the server over the whole file (up to the existing 100k-row budget):
- group by up to 2 columns;
- measures: count, sum, average, min, max, distinct;
- filters: equals, contains, greater, less, empty, not empty.

**Ask**
- The analyst types "revenue by region last quarter".
- The model is shown the question plus each column's name and type, **no values**, and returns a structured query.
- The server validates that query with Zod and runs it with the same engine as the builder.
- The query is shown as builder chips, so the analyst can check and adjust it.
- The answer is never sent back to the model.
- With AI off, the builder still works.

**Results**
- A Recharts bar or line chart plus a table, in the brand chart colours, reusing `features/analytics/chart-card.tsx` and `chart-tip.tsx`.
- **Download as CSV**.

**Backend**
- `files/explore/query-spec.ts`: a Zod spec. `executor.ts` is a pure group/aggregate over a `ParsedSheet`.
- A small per-instance LRU of parsed sheets, keyed by file id and capped by memory.
- `AiProvider.planQuery()`: a new method, implemented in the Gemini, Null and Fake providers, with the same "never throws" contract.
- Routes `POST /files/:id/explore` and `POST /files/:id/ask`. Scope `files:read`. Ask has a strict rate-limit bucket of its own.
- **Plan limit:** a new `PlanRules.questionsPerPeriod` (Free 20, Basic 300, Premium 3,000), enforced like the file quota.

**MCP.** `explore_file` and `ask_file` tools, so an agent can analyse a file without downloading it.

## Every feature, every doorway

Each feature ships as one vertical slice, committed in small steps and touching each registry the backend already has:

| Area | What to touch |
|---|---|
| Database | migration + `MIGRATIONS` index; `ENTITIES`; tenant index + `indexes.integration.spec.ts` |
| Audit | `AUDIT_ACTIONS` + `audit.coverage.integration.spec.ts`, e.g. `file.cleaned`, `dataset.settings_updated`, `file.diff_requested` |
| Notifications | `notificationContentSchema`, plus words in `frontend/src/features/notifications/describe.ts` |
| Webhooks | `SUBSCRIBABLE_WEBHOOK_EVENTS`, plus `frontend/src/features/webhooks/events.ts` |
| API keys | `@RequireScopes` on every route; check that `route-audit.spec.ts` passes |
| MCP | tools in `src/mcp/tools/files.tools.ts` (`defineTool`, re-checking permissions in the handler) |
| Docs | `docs/descriptions/*.yaml` → `npm run docs:generate`; frontend `npm run api:types`; guides in `frontend/src/lib/docs/content/` |
| Marketing | a new `Exhibit` on `/features` and home, plus `PRODUCT_LINKS`; update PRODUCT.md's capability list |
| Demo | the demo seed shows each feature: a sensitive column, a messy file with a cleaned version, a keyed dataset with a diff, a saved question |

## Bugs and gaps to fix along the way (Phase 0, first)

Found while mapping the code. Each is small and gets its own commit.

**Backend**
1. **The "more than 200 columns" header issue can never appear.** The reader cuts the header to 200 before the
   accumulator checks it, so profiling silently ignores columns past 200. Fix: pass `columnCount` through and report it.
2. **Duplicates are judged on the first 200 characters.** `comparable()` cuts every cell before fingerprinting, so two
   rows that differ after character 200 count as duplicates, and `unique` rules agree. Fingerprint the full trimmed value.
3. **Only the first sheet of a workbook is profiled, and nobody is told.**
   - Record the sheet names.
   - Say "profiled *Sales*; 2 other sheets".
   - Let the uploader choose the sheet. F2–F4 need this too.
4. **The backend does not type-check.** `tsc --noEmit` reports 7 errors in test files (`realtime.integration.spec.ts`,
   `test/support/socket-client.ts`, `request-of.spec.ts`).
5. **There is no CI.**
   - Add a GitHub Actions workflow for each app: lint, typecheck, unit tests, and backend integration tests against a
     Postgres service.
   - The frontend runs `biome` and `tsc`.
6. **The S3 driver cannot reach R2 or MinIO** (no endpoint setting). Add `AWS_ENDPOINT_URL` and path-style addressing.
7. **Stored objects can be orphaned** by a crash between storing and committing (a documented limitation). Add a daily
   janitor that deletes stored objects with no matching row and older than a day.
8. **Webhooks fail locally** until `DATA_ENCRYPTION_KEY` is set, and `.env.example` leaves it blank with no hint.
   Generate one in the setup notes, and make the error say what is missing.

**Frontend**
9. **Next.js 16.3.4 has a critical advisory** (RCE in `next/og`, fixed in 16.3.8). Bump it.
10. **Marketing promises live presence** ("Sam and Priya are looking at this file now"), but the app never joins a file's
    room. Wire `file.watch`, presence avatars, live comments and typing. The backend already emits all of it.
11. **The dashboard is thinner than SCOPE.md specifies.** Add:
    - the bill estimate (admins);
    - average quality score this period;
    - files that need attention (failed rules, sensitive data);
    - recent activity.
12. **The files list has no name search** and no status or score filter.
13. **The report panel never shows `typeCounts`** (what a mixed column is mixed with). Show it as a small stacked bar.
14. **Empty feature folders** hold only a `.gitkeep`: remove them.

## Order of work

1. **Phase 0**: items 1–14, smallest first; 4, 5 and 9 on the first day.
2. **F1, sensitive-data scan**: small, and adds profiling hooks the others use.
3. **F2, clean**: the refactor of `store` lands first, in its own commit, with the existing upload specs still passing unchanged.
4. **F3, what changed**.
5. **F4, explore and ask**.
6. **Marketing, docs and demo seed** for all four, then a full browser pass at desktop and phone width, light and dark.

## Decisions to confirm before F2

- **Does a cleaned version use up the file quota?** Recommended: **no**, because Gridline made it, not an upload.
  - It still counts toward the versions-per-dataset limit.
  - It still appears in the audit log.
  - The alternative is honest but feels like a penalty for using the feature.
- **Plan gating.**
  - Recommended: every plan gets scan, clean, diff and explore.
  - What differs: auto-clean (paid plans) and questions a period (20 / 300 / 3,000).
  - The numbers live in `PLAN_CATALOG`, so they can be changed in one line.

## How each slice is checked

- **Unit specs for every pure module** (detectors, cleaning steps, sheet writer, row diff, query executor), including:
  - a card number that fails Luhn;
  - a date step meeting an ambiguous `03/04/2026`;
  - a diff with a repeated key;
  - a query on an empty column.
- **Integration specs** cover, per route:
  - visibility: a restricted file is a 404 for a third person, and a diff needs both versions visible;
  - roles, scopes, demo refusal, plan limits, idempotency;
  - the audit entry, the notification, the webhook delivery;
  - the realtime event.
- **Mutation checks** on the access rule in each new route and on "the AI never sees a cell value". For the latter, a spec
  asserts that no cell from the fixture appears in the prompt `FakeAiProvider` received.
- **Gate:** `npm run build && npm run lint && npm test && npm run test:int && npm run docs:check` in the backend;
  `biome check` and `tsc` in the frontend.
- **Browser (Playwright):** the analyst's day.
  1. Upload a messy CSV with emails.
  2. See the sensitive-data warning and restrict the file.
  3. Clean it and watch the score rise on the compare page.
  4. Upload next month's file and read what changed by `customer_id`.
  5. Ask "total amount by region".
  6. Download the result.
