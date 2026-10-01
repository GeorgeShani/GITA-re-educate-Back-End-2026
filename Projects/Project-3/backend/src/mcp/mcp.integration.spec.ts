import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { generateApiKey } from '#/api-keys/api-key-token.js';
import { API_SCOPES, type ApiScope } from '#/common/auth/require-scopes.decorator.js';
import { ApiKey } from '#/api-keys/api-key.entity.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { DemoSeedService } from '#/demo/demo-seed.service.js';
import { DEMO_ADMIN } from '#/demo/demo-data.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { Notification } from '#/notifications/notification.entity.js';
import { ALL_TOOLS } from './mcp-server.factory.js';
import { MCP_BODY_LIMIT_BYTES } from './mcp-body-parser.js';

const callResult = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

const ALL_SCOPES: ApiScope[] = [...API_SCOPES];
const EMPLOYEE_SCOPES: ApiScope[] = ['mcp', 'files:read', 'files:write', 'notifications:read'];

describe('MCP server (integration)', () => {
  let h: AppHarness;
  let url: string;
  let admin: RegisteredAccount;
  let adminSession: SessionBody;
  let employee: RegisteredAccount & { session: SessionBody };
  let open: Client[];

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.app.listen(0);
    const address = h.app.getHttpServer().address();
    if (address === null || typeof address === 'string') throw new Error('the app is not listening on a port');
    url = `http://127.0.0.1:${address.port}/mcp`;
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    open = [];
    admin = await h.registerAndActivate();
    adminSession = await h.login(admin.email);
    await h.subscribe(adminSession, 'basic');
    employee = await h.inviteAndAccept(adminSession, admin.companyId);
  });

  afterEach(async () => {
    await Promise.all(open.map((client) => client.close()));
  });
  afterAll(() => h.stop());

  /** An agent with this bearer token (a key, or a session's access token). */
  async function agent(bearer: string): Promise<Client> {
    const client = new Client({ name: 'spec', version: '0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } }),
    );
    open.push(client);
    return client;
  }

  async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
    const result = callResult.parse(await client.callTool({ name, arguments: args }));
    const text = result.content.map((part) => part.text ?? '').join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { isError: result.isError === true, text, json };
  }

  const namesOf = async (client: Client) => (await client.listTools()).tools.map((tool) => tool.name).sort();
  const key = async (session: SessionBody, scopes: string[]) => (await h.createApiKey(session, { scopes })).key;
  const csv = (rows = 2) => `id,value\n${Array.from({ length: rows }, (_, index) => `${index},x`).join('\n')}\n`;
  const idOf = (value: unknown) => z.object({ id: z.uuid() }).parse(value).id;

  describe('who may call it', () => {
    it('refuses a call with no credentials (401) and a key without the mcp scope (403)', async () => {
      const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
      const accept = 'application/json, text/event-stream';
      await h.http().post('/mcp').set('Accept', accept).send(body).expect(401);

      const restOnly = await key(adminSession, ['files:read', 'files:write']);
      const refused = await h.http().post('/mcp').set('Accept', accept).set('Authorization', `Bearer ${restOnly}`).send(body).expect(403);
      expect(refused.body.message).toContain('mcp');
    });

    it('answers a signed-in session too (every tool its role allows)', async () => {
      const client = await agent(adminSession.accessToken);
      expect(await namesOf(client)).toEqual(ALL_TOOLS.map((tool) => tool.meta.name).sort());
    });

    it('has no stream and no session to end: GET and DELETE are 405', async () => {
      const bearer = await key(adminSession, ['mcp']);
      await h.http().get('/mcp').set('Authorization', `Bearer ${bearer}`).expect(405);
      await h.http().delete('/mcp').set('Authorization', `Bearer ${bearer}`).expect(405);
    });

    it('stops working the moment the key is revoked', async () => {
      const created = await h.createApiKey(adminSession, { scopes: ['mcp', 'files:read'] });
      const client = await agent(created.key);
      await call(client, 'list_files');
      await h.http().delete(`/api-keys/${created.id}`).set(...h.bearer(adminSession)).expect(200);
      await expect(call(client, 'list_files')).rejects.toThrow();
    });
  });

  describe('which tools an agent sees', () => {
    it('follows the key’s scopes and the creator’s role, and never lists what would be refused', async () => {
      const readOnly = await agent(await key(adminSession, ['mcp', 'files:read']));
      const names = await namesOf(readOnly);
      expect(names).toContain('list_files');
      expect(names).toContain('list_quality_rules');
      for (const hidden of ['upload_file', 'create_quality_rule', 'get_current_bill', 'list_audit_log', 'list_notifications']) {
        expect(names).not.toContain(hidden);
      }

      const adminAll = await namesOf(await agent(await key(adminSession, ALL_SCOPES)));
      expect(adminAll).toHaveLength(ALL_TOOLS.length);

      // An employee cannot hold the admin scopes at all, so no tool needing them can appear.
      await h.http().post('/api-keys').set(...h.bearer(employee.session)).send({ name: 'k', scopes: ['rules:write'] }).expect(403);
      const employeeNames = await namesOf(await agent(await key(employee.session, EMPLOYEE_SCOPES)));
      for (const hidden of ['create_quality_rule', 'get_current_bill', 'list_audit_log']) expect(employeeNames).not.toContain(hidden);
      expect(employeeNames).toContain('upload_file');
    });

    it('a demo company’s agent sees no write tools, and a direct call to one is refused', async () => {
      await h.app.get(DemoSeedService).seed();
      const demoAdmin = await h.dataSource.getRepository(User).findOneByOrFail({ email: DEMO_ADMIN.email });
      const { plaintext, prefix, hash } = generateApiKey();
      await h.dataSource.getRepository(ApiKey).insert({
        companyId: demoAdmin.companyId,
        createdByUserId: demoAdmin.id,
        name: 'demo agent',
        prefix,
        keyHash: hash,
        scopes: ALL_SCOPES,
      });

      const client = await agent(plaintext);
      const names = await namesOf(client);
      const writes = ALL_TOOLS.filter((tool) => tool.meta.write).map((tool) => tool.meta.name);
      expect(names.length).toBeGreaterThan(0);
      for (const write of writes) expect(names).not.toContain(write);

      const direct = await call(client, 'upload_file', { name: 'x.csv', text: csv() });
      expect(direct.isError).toBe(true);
      expect(direct.text).toContain('not found');
      expect((await call(client, 'list_files')).isError).toBe(false);
    });
  });

  describe('reading', () => {
    it('shows what REST shows: a restricted file is absent for a colleague, and a file of another company is not found', async () => {
      const restricted = await h.upload(adminSession, { visibility: 'restricted', name: 'private.csv' }).expect(201);
      const shared = await h.upload(adminSession, { name: 'shared.csv' }).expect(201);
      const stranger = await h.registerAndActivate();
      const strangerSession = await h.login(stranger.email);
      await h.subscribe(strangerSession, 'basic');
      const foreign = await h.upload(strangerSession, { name: 'foreign.csv' }).expect(201);

      const client = await agent(await key(employee.session, EMPLOYEE_SCOPES));
      const listed = z
        .object({ data: z.array(z.object({ id: z.uuid(), originalName: z.string() })) })
        .parse((await call(client, 'list_files')).json);
      expect(listed.data.map((file) => file.originalName)).toEqual(['shared.csv']);

      for (const id of [idOf(restricted.body), idOf(foreign.body)]) {
        const refused = await call(client, 'get_file', { id });
        expect(refused.isError).toBe(true);
        expect(refused.text).toMatch(/^404 /);
      }
      expect((await call(client, 'get_file', { id: idOf(shared.body) })).isError).toBe(false);
    });

    it('returns the report once the background build has run, and rejects a malformed argument', async () => {
      const uploaded = await h.upload(adminSession, { content: csv(3) }).expect(201);
      const client = await agent(await key(adminSession, ['mcp', 'files:read']));

      await h.drainTasks();
      const report = await call(client, 'get_quality_report', { id: idOf(uploaded.body) });
      expect(report.json).toMatchObject({ status: 'ready' });

      await expect(client.callTool({ name: 'get_file', arguments: { id: 'not-a-uuid' } })).resolves.toMatchObject({ isError: true });
      const badFilter = await call(client, 'list_files', { visibility: 'everyone' });
      expect(badFilter.isError).toBe(true);
    });

    it('lets an admin with the audit and billing scopes read them, and an agent without them never sees them', async () => {
      await h.upload(adminSession).expect(201);
      const client = await agent(await key(adminSession, ALL_SCOPES));
      const log = z.object({ data: z.array(z.object({ action: z.string() })) }).parse((await call(client, 'list_audit_log')).json);
      expect(log.data.map((entry) => entry.action)).toContain('file.uploaded');
      expect((await call(client, 'get_current_bill')).isError).toBe(false);
      expect((await call(client, 'get_plan_and_quota')).json).toMatchObject({ plan: 'basic' });
    });
  });

  describe('uploading', () => {
    it('stores a CSV from text like POST /files does: a file, a usage event, a report, and an audit entry that says MCP', async () => {
      const created = await h.createApiKey(employee.session, { scopes: EMPLOYEE_SCOPES });
      const client = await agent(created.key);

      const uploaded = await call(client, 'upload_file', { name: 'from-agent.csv', text: csv(4) });
      expect(uploaded.isError).toBe(false);
      const fileId = idOf(uploaded.json);
      expect(uploaded.json).toMatchObject({ originalName: 'from-agent.csv', mimeType: 'text/csv', uploaderId: employee.userId });

      expect(await h.dataSource.getRepository(UsageEvent).count({ where: { fileId } })).toBe(1);
      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'file.uploaded', targetId: fileId });
      expect(entry.actorUserId).toBe(employee.userId);
      expect(entry.metadata).toMatchObject({ apiKeyId: created.id, via: 'mcp' });

      await h.drainTasks();
      expect((await call(client, 'get_quality_report', { id: fileId })).json).toMatchObject({ status: 'ready' });
    });

    it('does not mark a plain REST upload as MCP', async () => {
      const uploaded = await h.upload(adminSession).expect(201);
      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'file.uploaded', targetId: idOf(uploaded.body) });
      expect(entry.metadata).not.toHaveProperty('via');
    });

    it('adds a version to a file the caller uploaded', async () => {
      const client = await agent(await key(adminSession, ALL_SCOPES));
      const first = idOf((await call(client, 'upload_file', { name: 'sales.csv', text: csv(2) })).json);
      const second = await call(client, 'upload_file_version', { id: first, name: 'sales.csv', text: csv(5) });
      expect(second.json).toMatchObject({ version: 2, isLatest: true });
      const versions = z.object({ data: z.array(z.object({ version: z.number() })) }).parse((await call(client, 'list_file_versions', { id: first })).json);
      expect(versions.data.map((file) => file.version)).toEqual([2, 1]);
    });

    it('refuses a spreadsheet that is not one, whatever it is called, and one that is too big', async () => {
      const client = await agent(await key(adminSession, ALL_SCOPES));
      const exe = await call(client, 'upload_file', { name: 'report.csv', base64: Buffer.from('MZ\u0090\u0000\u0003\u0000\u0000\u0000binary').toString('base64') });
      expect(exe.isError).toBe(true);
      expect(exe.text).toMatch(/^400 /);

      const both = await call(client, 'upload_file', { name: 'a.csv', text: csv(), base64: 'aWQs' });
      expect(both.isError).toBe(true);
      expect(await h.dataSource.getRepository(FileAsset).count()).toBe(0);

      const big = await h
        .http()
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${await key(adminSession, ALL_SCOPES)}`)
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'upload_file', arguments: { name: 'big.csv', text: 'x'.repeat(MCP_BODY_LIMIT_BYTES) } } });
      expect(big.status).toBe(413);
    });

    it('answers a quota refusal as an error that says why (402)', async () => {
      const free = await h.registerAndActivate();
      const freeSession = await h.login(free.email);
      await h.subscribe(freeSession, 'free');
      for (let count = 0; count < 10; count += 1) await h.upload(freeSession).expect(201);

      const client = await agent(await key(freeSession, ALL_SCOPES));
      const refused = await call(client, 'upload_file', { name: 'eleventh.csv', text: csv() });
      expect(refused.isError).toBe(true);
      expect(refused.text).toMatch(/^402 /);
    });

    it('is safe to retry: the same idempotencyKey uploads once; the same key for other content is refused', async () => {
      const client = await agent(await key(adminSession, ALL_SCOPES));
      const idempotencyKey = randomUUID();
      const args = { name: 'once.csv', text: csv(3), idempotencyKey };

      const first = await call(client, 'upload_file', args);
      const retry = await call(client, 'upload_file', args);
      expect(first.isError).toBe(false);
      expect(retry.json).toMatchObject({ replayed: true, result: { id: idOf(first.json) } });
      expect(await h.dataSource.getRepository(FileAsset).count()).toBe(1);
      expect(await h.dataSource.getRepository(UsageEvent).count()).toBe(1);

      const different = await call(client, 'upload_file', { ...args, text: csv(9) });
      expect(different.isError).toBe(true);
      expect(different.text).toMatch(/^422 /);
    });

    it('forgets a failed attempt, so the retry with the same key can run', async () => {
      const client = await agent(await key(adminSession, ALL_SCOPES));
      const idempotencyKey = randomUUID();
      const bad = await call(client, 'upload_file', { name: 'a.csv', base64: Buffer.from('MZ\u0090\u0000\u0003\u0000binary').toString('base64'), idempotencyKey });
      expect(bad.isError).toBe(true);
      const retry = await call(client, 'upload_file', { name: 'a.csv', base64: Buffer.from('MZ\u0090\u0000\u0003\u0000binary').toString('base64'), idempotencyKey });
      expect(retry.text).toMatch(/^400 /);
    });
  });

  describe('changing rules', () => {
    it('lets an admin key with rules:write manage rules, and audits it as MCP', async () => {
      const created = await h.createApiKey(adminSession, { scopes: ALL_SCOPES });
      const client = await agent(created.key);
      const rule = await call(client, 'create_quality_rule', { name: 'Ids present', kind: 'required_column', columnName: 'id' });
      expect(rule.isError).toBe(false);
      const ruleId = idOf(rule.json);

      expect((await call(client, 'update_quality_rule', { id: ruleId, severity: 'warning' })).json).toMatchObject({ severity: 'warning' });
      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'quality_rule.created' });
      expect(entry.metadata).toMatchObject({ via: 'mcp', apiKeyId: created.id });

      expect((await call(client, 'delete_quality_rule', { id: ruleId })).isError).toBe(false);
      const rules = z.object({ data: z.array(z.unknown()) }).parse((await call(client, 'list_quality_rules')).json);
      expect(rules.data).toHaveLength(0);
    });

    it('holds an agent to the same validation as REST', async () => {
      const client = await agent(await key(adminSession, ALL_SCOPES));
      const bad = await call(client, 'create_quality_rule', { name: 'Nulls', kind: 'max_null_percent', columnName: 'id', params: { max: 400 } });
      expect(bad.isError).toBe(true);
      expect(bad.text).toMatch(/^400 /);
    });
  });

  describe('notifications', () => {
    it('reads and marks only the caller’s own inbox', async () => {
      const mine = await h.dataSource.getRepository(Notification).save({
        companyId: admin.companyId,
        userId: employee.userId,
        type: 'report.ready',
        payload: { fileId: randomUUID(), fileName: 'a.csv' },
      });
      const theirs = await h.dataSource.getRepository(Notification).save({
        companyId: admin.companyId,
        userId: admin.userId,
        type: 'report.ready',
        payload: { fileId: randomUUID(), fileName: 'a.csv' },
      });

      const client = await agent(await key(employee.session, EMPLOYEE_SCOPES));
      expect((await call(client, 'get_unread_count')).json).toMatchObject({ count: 1 });

      const foreign = await call(client, 'mark_notifications_read', { id: theirs.id });
      expect(foreign.isError).toBe(true);
      expect(foreign.text).toMatch(/^404 /);
      expect((await call(client, 'mark_notifications_read', {})).isError).toBe(true);

      expect((await call(client, 'mark_notifications_read', { all: true })).json).toMatchObject({ updated: 1 });
      expect((await call(client, 'get_unread_count')).json).toMatchObject({ count: 0 });
      const untouched = await h.dataSource.getRepository(Notification).findOneByOrFail({ id: theirs.id });
      expect(untouched.readAt).toBeNull();
      expect((await h.dataSource.getRepository(Notification).findOneByOrFail({ id: mine.id })).readAt).not.toBeNull();
    });
  });
});

describe('MCP server and the plan throttle (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start({ rateLimit: true });
  }, 120_000);
  afterAll(() => h.stop());

  it('spends the company’s per-minute budget: every MCP request counts, like any other', async () => {
    h.clientAddress = '203.0.113.7';
    await h.reset();
    const account = await h.registerAndActivate();
    const session = await h.login(account.email);
    await h.subscribe(session, 'free');
    const { key } = await h.createApiKey(session, { scopes: ['mcp', 'files:read'] });

    const ping = () =>
      h
        .http()
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${key}`)
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

    const statuses: number[] = [];
    for (let count = 0; count < 40; count += 1) statuses.push((await ping()).status);
    expect(statuses).toContain(429);
    expect(statuses[0]).toBe(200);
  });
});
