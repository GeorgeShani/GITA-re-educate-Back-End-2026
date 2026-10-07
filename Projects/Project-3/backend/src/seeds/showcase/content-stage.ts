import { writeXlsx } from '#/files/cleaning/sheet-writer.js';
import type { CellValue } from '#/files/quality/metrics.js';
import { type Api, MIME, type Session } from './api-client.js';
import type { Credentials } from './credentials.js';
import type { PeopleResult } from './people-stage.js';
import { type ShowcaseCompany, addressFor } from './plan.js';
import type { SeedFormat } from './data/shared.js';
import { type Table, toCsv } from './data/table.js';
import type { Actor, CompanyContent } from './data/types.js';

interface FileRow {
  id: string;
  datasetId: string;
  originalName: string;
  version: number;
  derivedFromFileId: string | null;
}
interface Page<T> {
  data: T[];
  meta: { nextCursor?: string | null; hasMore?: boolean; totalPages?: number };
}
interface EmployeeRow {
  id: string;
  email: string;
  status: string;
}
interface JobRow {
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  errorMessage: string | null;
}

export interface ContentSummary {
  slug: string;
  uploaded: number;
  versions: number;
  rules: number;
  comments: number;
  queries: number;
  cleaned: boolean;
  invited: boolean;
  removed: number;
  /** Everything that went wrong, in words. A step that fails does not stop the others. */
  failures: string[];
  notes: string[];
}

const WHOLE_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A workbook holds real numbers and real dates, not text that looks like them (a CSV can only hold text). */
function typedCell(cell: string): CellValue {
  if (cell === '') return null;
  if (WHOLE_NUMBER.test(cell) && cell.length < 16) return Number(cell);
  if (ISO_DAY.test(cell)) return new Date(`${cell}T00:00:00.000Z`);
  return cell;
}

export async function fileBytes(format: SeedFormat, table: Table, sheetName: string): Promise<{ bytes: Uint8Array; mime: string }> {
  if (format === 'csv') return { bytes: Buffer.from(toCsv(table), 'utf8'), mime: MIME.csv };
  const rows = table.rows.map((row) => row.map(typedCell));
  return { bytes: await writeXlsx(table.header, rows, sheetName), mime: MIME.xlsx };
}

export interface ContentOptions {
  api: Api;
  credentials: Credentials;
  mailbox: string;
  skipAi: boolean;
  log: (line: string) => void;
  /** Milliseconds between looks at a cleaning job. */
  pollMs?: number;
  /** How long a cleaning job may take before it is reported as stuck. */
  cleanTimeoutMs?: number;
}

/**
 * Stage 2, the HTTP half: everything done AS the real people, through the live API, so storage, reports, row comparisons, quota,
 * audit, notifications and Stripe usage all take their real path. Every step looks at what is already there first, so a second run
 * adds nothing, and a step that fails is reported at the end without stopping the rest.
 */
export class ContentStage {
  constructor(private readonly options: ContentOptions) {}

  async run(spec: ShowcaseCompany, people: PeopleResult, content: CompanyContent): Promise<ContentSummary> {
    const summary: ContentSummary = { slug: spec.slug, uploaded: 0, versions: 0, rules: 0, comments: 0, queries: 0, cleaned: false, invited: false, removed: 0, failures: [], notes: [] };
    const run = new CompanyRun(this.options, spec, people, content, summary);
    await run.go();
    return summary;
  }
}

class CompanyRun {
  private readonly sessions = new Map<string, Session>();
  /** File key → the dataset it started, shared by all its versions. */
  private readonly datasets = new Map<string, string>();
  /** File key → the newest version that was UPLOADED (not cleaned): what comments and questions are about. */
  private readonly targets = new Map<string, string>();

  constructor(
    private readonly options: ContentOptions,
    private readonly spec: ShowcaseCompany,
    private readonly people: PeopleResult,
    private readonly content: CompanyContent,
    private readonly summary: ContentSummary,
  ) {}

  async go(): Promise<void> {
    this.say(`${this.spec.name}`);
    await this.step('quality rules', () => this.rules());
    await this.step('first uploads', () => this.uploads());
    await this.step('key columns', () => this.keyColumns());
    await this.step('new versions', () => this.versions());
    await this.step('cleaning', () => this.clean());
    await this.step('comments', () => this.comments());
    await this.step('queries', () => this.queries());
    await this.step('people changes', () => this.peopleChanges());
  }

  private say(line: string): void {
    this.options.log(`[${this.spec.slug}] ${line}`);
  }

  private async step(name: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.summary.failures.push(`${name}: ${text}`);
      this.say(`FAILED ${name}: ${text}`);
    }
  }

  /** A failure of one item inside a step: noted, and the step carries on with the next. */
  private async item(name: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.summary.failures.push(`${name}: ${text}`);
      this.say(`FAILED ${name}: ${text}`);
    }
  }

  private emailOf(actor: Actor): string {
    const person = actor === 'admin' ? this.spec.admin : this.spec.employees[actor];
    if (!person) throw new Error(`The plan has no employee at position ${String(actor)}.`);
    return addressFor(this.options.mailbox, this.spec.slug, person.fullName);
  }

  private async as(actor: Actor): Promise<Session> {
    const email = this.emailOf(actor);
    const known = this.sessions.get(email);
    if (known) return known;
    const saved = this.options.credentials.find(this.spec.slug, email);
    if (!saved) throw new Error(`No saved password for ${email}.`);
    const session = await this.options.api.signIn(email, saved.password);
    this.sessions.set(email, session);
    return session;
  }

  private employeeId(position: number): string {
    const id = this.people.employeeIds[position];
    if (!id) throw new Error(`No employee at roster position ${position}.`);
    return id;
  }

  private async pages<T>(session: Session, path: string): Promise<T[]> {
    const rows: T[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 50; guard += 1) {
      const joiner = path.includes('?') ? '&' : '?';
      const page: Page<T> = await session.get<Page<T>>(`${path}${joiner}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      rows.push(...page.data);
      if (!page.meta.hasMore || !page.meta.nextCursor) break;
      cursor = page.meta.nextCursor;
    }
    return rows;
  }

  private async versionsOf(session: Session, datasetId: string): Promise<FileRow[]> {
    const page = await session.get<Page<FileRow>>(`/files/${datasetId}/versions?limit=100`);
    return page.data;
  }

  /** The newest version that was uploaded rather than made by cleaning. */
  private newestUpload(rows: readonly FileRow[]): FileRow {
    const uploads = rows.filter((row) => row.derivedFromFileId === null).sort((a, b) => b.version - a.version);
    const newest = uploads[0];
    if (!newest) throw new Error('A dataset with no uploaded version.');
    return newest;
  }

  private async rules(): Promise<void> {
    const admin = await this.as('admin');
    const existing = new Set((await admin.get<Page<{ name: string }>>('/quality-rules?limit=100')).data.map((rule) => rule.name));
    for (const rule of this.content.rules) {
      if (existing.has(rule.name)) continue;
      await this.item(`rule "${rule.name}"`, async () => {
        await admin.post('/quality-rules', { name: rule.name, kind: rule.kind, columnName: rule.columnName, params: rule.params, severity: rule.severity });
        this.summary.rules += 1;
      });
    }
    this.say(`rules: ${this.summary.rules} created, ${existing.size} already there`);
  }

  private async uploads(): Promise<void> {
    const admin = await this.as('admin');
    // Every version, not only the newest: a cleaned version becomes the newest, and its name is not the upload's.
    const uploaded = (await this.pages<FileRow>(admin, '/files?allVersions=true')).filter((file) => file.derivedFromFileId === null);
    const existing = new Map(uploaded.map((file) => [file.originalName, file]));
    for (const file of this.content.files) {
      await this.item(`upload ${file.name}`, async () => {
        const found = existing.get(file.name);
        if (found) {
          this.datasets.set(file.key, found.datasetId);
          return;
        }
        const uploader = await this.as(file.uploader);
        const { bytes, mime } = await fileBytes(file.format, file.table, file.name.replace(/\.[^.]+$/, ''));
        const fields: Record<string, string | string[]> = { visibility: file.access?.visibility ?? 'company' };
        if (file.access?.visibility === 'restricted') fields.grantedUserIds = (file.access.grantedTo ?? []).map((position) => this.employeeId(position));
        const created = await uploader.upload<FileRow>('/files', { bytes, name: file.name, mime, fields });
        this.datasets.set(file.key, created.datasetId);
        this.summary.uploaded += 1;
        this.say(`uploaded ${file.name} (${file.table.rows.length} rows)`);
      });
    }
  }

  private async keyColumns(): Promise<void> {
    const admin = await this.as('admin');
    for (const [key, columns] of Object.entries(this.content.keyColumns)) {
      const datasetId = this.datasets.get(key);
      if (!datasetId) continue;
      await this.item(`key columns of ${key}`, async () => {
        const current = await admin.get<{ keyColumns: string[] }>(`/datasets/${datasetId}/settings`);
        if (JSON.stringify(current.keyColumns) === JSON.stringify(columns)) return;
        await admin.put(`/datasets/${datasetId}/settings`, { keyColumns: columns });
        this.say(`${key}: rows are identified by ${columns.join(', ')}`);
      });
    }
  }

  private async versions(): Promise<void> {
    const admin = await this.as('admin');
    const planned = new Map<string, number>();
    for (const version of this.content.versions) {
      const datasetId = this.datasets.get(version.of);
      if (!datasetId) continue;
      const index = planned.get(version.of) ?? 0;
      planned.set(version.of, index + 1);
      await this.item(`version of ${version.of}`, async () => {
        const uploads = (await this.versionsOf(admin, datasetId)).filter((row) => row.derivedFromFileId === null);
        if (uploads.length >= 2 + index) return;
        const uploader = await this.as(version.uploader);
        const { bytes, mime } = await fileBytes(version.format, version.table, version.name.replace(/\.[^.]+$/, ''));
        await uploader.upload(`/files/${datasetId}/versions`, { bytes, name: version.name, mime });
        this.summary.versions += 1;
        this.say(`uploaded version ${uploads.length + 1} of ${version.name}`);
      });
    }
    // What comments and questions are about: the newest upload of every dataset, whatever happened to it afterwards.
    for (const [key, datasetId] of this.datasets) {
      await this.item(`find the newest version of ${key}`, async () => {
        this.targets.set(key, this.newestUpload(await this.versionsOf(admin, datasetId)).id);
      });
    }
  }

  private async clean(): Promise<void> {
    const plan = this.content.clean;
    if (!plan) return;
    const datasetId = this.datasets.get(plan.file);
    const target = this.targets.get(plan.file);
    if (!datasetId || !target) return;
    const admin = await this.as('admin');
    if ((await this.versionsOf(admin, datasetId)).some((row) => row.derivedFromFileId !== null)) {
      this.say(`${plan.file}: already cleaned`);
      return;
    }
    const job = await admin.post<{ id: string }>(`/files/${target}/clean`, { recipe: plan.recipe });
    const timeout = this.options.cleanTimeoutMs ?? 120_000;
    const pollMs = this.options.pollMs ?? 2_000;
    for (let waited = 0; waited <= timeout; waited += pollMs) {
      const state = await admin.get<JobRow>(`/files/${target}/clean/jobs/${job.id}`);
      if (state.status === 'succeeded') {
        this.summary.cleaned = true;
        this.say(`cleaned ${plan.file} into a new version`);
        return;
      }
      if (state.status === 'failed') throw new Error(`the cleaning job failed: ${state.errorMessage ?? 'no reason given'}`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    throw new Error('the cleaning job did not finish in time (is the API running its background tasks?)');
  }

  private async comments(): Promise<void> {
    const made: Array<string | undefined> = [];
    const seen = new Map<string, Array<{ id: string; body: string | null }>>();
    for (const [index, comment] of this.content.comments.entries()) {
      await this.item(`comment ${index + 1}`, async () => {
        const fileId = this.targets.get(comment.file);
        if (!fileId) throw new Error(`no file "${comment.file}" to comment on`);
        const author = await this.as(comment.author);
        let there = seen.get(fileId);
        if (!there) {
          there = await this.pages<{ id: string; body: string | null }>(author, `/files/${fileId}/comments`);
          seen.set(fileId, there);
        }
        const same = there.find((row) => row.body === comment.body);
        if (same) {
          made[index] = same.id;
          return;
        }
        const parentId = comment.replyTo === undefined ? undefined : made[comment.replyTo];
        const created = await author.post<{ id: string }>(`/files/${fileId}/comments`, {
          body: comment.body,
          ...(parentId ? { parentId } : {}),
          mentionedUserIds: (comment.mentions ?? []).map((position) => this.employeeId(position)),
        });
        made[index] = created.id;
        this.summary.comments += 1;
      });
    }
  }

  private async queries(): Promise<void> {
    const admin = await this.as('admin');
    for (const [index, explore] of this.content.explores.entries()) {
      const marker = `${this.spec.slug}:explore:${index}`;
      if (this.options.credentials.isDone(marker)) continue;
      await this.item(`query ${index + 1}`, async () => {
        const fileId = this.targets.get(explore.file);
        if (!fileId) throw new Error(`no file "${explore.file}"`);
        await admin.post(`/files/${fileId}/explore`, { query: explore.query });
        await this.options.credentials.markDone(marker);
        this.summary.queries += 1;
      });
    }

    if (this.options.skipAi || this.content.asks.length === 0) return;
    const first = this.targets.get(this.content.asks[0]?.file ?? '');
    if (!first) return;
    const allowance = await admin.get<{ aiAvailable: boolean }>(`/files/${first}/ask/allowance`);
    if (!allowance.aiAvailable) {
      this.summary.notes.push('The AI assistant is switched off on this server, so no questions were asked.');
      return;
    }
    for (const [index, ask] of this.content.asks.entries()) {
      const marker = `${this.spec.slug}:ask:${index}`;
      if (this.options.credentials.isDone(marker)) continue;
      await this.item(`question "${ask.question}"`, async () => {
        const fileId = this.targets.get(ask.file);
        if (!fileId) throw new Error(`no file "${ask.file}"`);
        await admin.post(`/files/${fileId}/ask`, { question: ask.question });
        await this.options.credentials.markDone(marker);
        this.summary.queries += 1;
      });
    }
  }

  private async peopleChanges(): Promise<void> {
    const invitee = this.spec.invitee;
    const removals = this.spec.employees.filter((person) => person.removed);
    if (!invitee && removals.length === 0) return;

    const admin = await this.as('admin');
    const list = async (): Promise<EmployeeRow[]> => (await admin.get<Page<EmployeeRow>>('/employees?limit=100')).data;
    if (invitee) {
      await this.item(`invite ${invitee.fullName}`, async () => {
        const email = addressFor(this.options.mailbox, this.spec.slug, invitee.fullName);
        if ((await list()).some((row) => row.email === email)) return;
        await admin.post('/employees', { email, fullName: invitee.fullName });
        this.summary.invited = true;
        this.summary.notes.push(`${invitee.fullName} was invited at ${email}. Open that email in your inbox to accept it and choose a password.`);
      });
    }
    for (const person of removals) {
      await this.item(`remove ${person.fullName}`, async () => {
        const email = addressFor(this.options.mailbox, this.spec.slug, person.fullName);
        const row = (await list()).find((candidate) => candidate.email === email);
        if (!row || row.status === 'disabled') return;
        await admin.delete(`/employees/${row.id}`);
        this.summary.removed += 1;
      });
    }
  }
}
