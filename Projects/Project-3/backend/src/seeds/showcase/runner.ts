import type { DataSource } from 'typeorm';
import type { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import type { AppConfig } from '#/config/env.schema.js';
import type { AuditService } from '#/core/audit/audit.service.js';
import type { Clock } from '#/core/clock/clock.js';
import type { BillingSyncService } from '#/payments/billing-sync.service.js';
import type { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';
import { AccountsStage } from './accounts-stage.js';
import { Api, type ApiOptions } from './api-client.js';
import { ContentStage, type ContentSummary } from './content-stage.js';
import { Credentials } from './credentials.js';
import { PeopleStage, preflightProblems } from './people-stage.js';
import { SHOWCASE, type ShowcaseCompany } from './plan.js';
import type { ShowcaseArgs } from './args.js';

export interface RunnerDeps {
  dataSource: DataSource;
  hasher: PasswordHasher;
  config: Pick<AppConfig, 'isProduction'>;
  clock: Clock;
  audit: AuditService;
  subscriptions: SubscriptionsService;
  billingSync: BillingSyncService;
  log: (line: string) => void;
  /** For tests: the plan to seed (default: the three showcase companies) and how the API client behaves. */
  companies?: readonly ShowcaseCompany[];
  apiOptions?: ApiOptions;
  pollMs?: number;
}

export interface ContentRunResult {
  /** Why nothing was done, when the content stage stopped before starting. */
  blocked: string[];
  summaries: ContentSummary[];
}

/** The two stages, wired to their dependencies. The command line and the integration spec both go through here. */
export class ShowcaseRunner {
  constructor(private readonly deps: RunnerDeps) {}

  private get companies(): readonly ShowcaseCompany[] {
    return this.deps.companies ?? SHOWCASE;
  }

  async accounts(args: Pick<ShowcaseArgs, 'mailbox' | 'credentialsPath' | 'confirmProduction'>): Promise<void> {
    const credentials = await Credentials.open(args.credentialsPath, args.mailbox);
    const stage = new AccountsStage(this.deps.dataSource, this.deps.hasher, this.deps.config, this.deps.clock, this.deps.audit);
    const results = await stage.run({ mailbox: args.mailbox, credentials, confirmProduction: args.confirmProduction, companies: this.companies });
    for (const result of results) this.deps.log(`${result.slug}: ${result.created ? 'created' : 'already there'}`);
  }

  async content(args: Pick<ShowcaseArgs, 'mailbox' | 'credentialsPath' | 'api' | 'skipAi'>): Promise<ContentRunResult> {
    if (!args.api) throw new Error('The content stage needs --api.');
    const problems: string[] = [];
    for (const spec of this.companies) problems.push(...(await preflightProblems(this.deps.dataSource, spec, args.mailbox)));
    if (problems.length > 0) return { blocked: problems, summaries: [] };

    const credentials = await Credentials.open(args.credentialsPath, args.mailbox);
    const api = new Api(args.api, this.deps.apiOptions);
    const people = new PeopleStage(this.deps.dataSource, this.deps.hasher, this.deps.subscriptions, this.deps.billingSync, this.deps.audit, this.deps.clock);
    const content = new ContentStage({ api, credentials, mailbox: args.mailbox, skipAi: args.skipAi, log: this.deps.log, pollMs: this.deps.pollMs });

    const summaries: ContentSummary[] = [];
    for (const spec of this.companies) {
      const added = await people.run(spec, args.mailbox, credentials);
      this.deps.log(`[${spec.slug}] people: ${added.added} added, ${added.alreadyThere} already there`);
      summaries.push(await content.run(spec, added, spec.content()));
    }
    return { blocked: [], summaries };
  }
}
