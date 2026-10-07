import { randomInt } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

const personSchema = z.object({
  role: z.enum(['admin', 'employee']),
  fullName: z.string(),
  email: z.string(),
  password: z.string(),
  note: z.string().optional(),
});
const fileSchema = z.object({
  mailbox: z.string(),
  /** Steps of the content stage that must not be repeated (a question put to the AI, say), by key. */
  done: z.array(z.string()).default([]),
  companies: z.array(
    z.object({ slug: z.string(), name: z.string(), billingEmail: z.string(), plan: z.string(), people: z.array(personSchema) }),
  ),
});
type Person = z.infer<typeof personSchema>;
type CredentialsData = z.infer<typeof fileSchema>;

// No 0/O or 1/l/I: these are read off a screen and typed by hand.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!#$%*+-=?@^_';

/** 20 random characters with at least one of each kind, from the operating system's random source. */
export function generatePassword(): string {
  const pick = (set: string): string => set.charAt(randomInt(set.length));
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS), ...Array.from({ length: 16 }, () => pick(all))];
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [chars[index], chars[other]] = [chars[other] ?? '', chars[index] ?? ''];
  }
  return chars.join('');
}

/**
 * Everyone the seed creates, with the password it chose. It lives in two git-ignored files next to the backend: a JSON the later
 * stages read, and a Markdown page to read yourself. A password is saved BEFORE the account is written, so a crash between the
 * two never leaves an account nobody can sign in to.
 */
export class Credentials {
  private constructor(
    private readonly path: string,
    private data: CredentialsData,
  ) {}

  static async open(path: string, mailbox: string): Promise<Credentials> {
    try {
      const data = fileSchema.parse(JSON.parse(await readFile(path, 'utf8')));
      if (data.mailbox !== mailbox) throw new Error(`${path} was made for ${data.mailbox}, not ${mailbox}. Use the same --mailbox, or move that file away.`);
      return new Credentials(path, data);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return new Credentials(path, { mailbox, done: [], companies: [] });
      throw error;
    }
  }

  /** The saved entry for a person, or a new one (with a new password) saved to disk before this returns. */
  async person(
    company: { slug: string; name: string; billingEmail: string; plan: string },
    who: { role: 'admin' | 'employee'; fullName: string; email: string; note?: string },
  ): Promise<Person> {
    let entry = this.data.companies.find((candidate) => candidate.slug === company.slug);
    if (!entry) {
      entry = { ...company, people: [] };
      this.data.companies.push(entry);
    }
    entry.plan = company.plan;
    const existing = entry.people.find((candidate) => candidate.email === who.email);
    if (existing) return existing;
    const created: Person = { ...who, password: generatePassword() };
    entry.people.push(created);
    await this.save();
    return created;
  }

  /** Every person saved, across companies. */
  everyone(): Person[] {
    return this.data.companies.flatMap((company) => company.people);
  }

  isDone(key: string): boolean {
    return this.data.done.includes(key);
  }

  async markDone(key: string): Promise<void> {
    if (this.isDone(key)) return;
    this.data.done.push(key);
    await this.save();
  }

  find(slug: string, email: string): Person | undefined {
    return this.data.companies.find((company) => company.slug === slug)?.people.find((person) => person.email === email);
  }

  async setNote(slug: string, email: string, note: string): Promise<void> {
    const found = this.find(slug, email);
    if (found) found.note = note;
    await this.save();
  }

  async save(): Promise<void> {
    await writeFile(this.path, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 });
    await writeFile(this.path.replace(/\.json$/, '.md'), this.markdown(), { mode: 0o600 });
  }

  private markdown(): string {
    const lines = ['# Gridline seeded accounts', '', 'Local file. Never commit it, and delete it when you no longer need it.', ''];
    for (const company of this.data.companies) {
      lines.push(`## ${company.name} (${company.plan})`, '', `Billing address: ${company.billingEmail}`, '', '| Role | Name | Email | Password | Note |', '|---|---|---|---|---|');
      for (const person of company.people) {
        lines.push(`| ${person.role} | ${person.fullName} | ${person.email} | \`${person.password}\` | ${person.note ?? ''} |`);
      }
      lines.push('');
    }
    return `${lines.join('\n')}\n`;
  }
}
