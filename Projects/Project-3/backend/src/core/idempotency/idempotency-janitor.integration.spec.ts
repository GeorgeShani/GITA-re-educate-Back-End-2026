import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness } from '#test/support/app-harness.js';
import { IDEMPOTENCY_STALE_CLAIM_MS, IDEMPOTENCY_TTL_MS } from './idempotency.interceptor.js';
import { IdempotencyJanitor } from './idempotency-janitor.service.js';
import { IdempotencyRecord } from './idempotency-record.entity.js';

describe('idempotency record janitor (integration)', () => {
  let h: AppHarness;
  let companyId: string;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    companyId = (await h.registerAndActivate()).companyId;
  });
  afterAll(() => h.stop());

  const records = () => h.dataSource.getRepository(IdempotencyRecord);
  const janitor = () => h.app.get(IdempotencyJanitor);

  async function insert(key: string, status: 'in_progress' | 'completed', createdAt: Date) {
    await records().insert({ companyId, key, route: 'POST /files', requestHash: 'h', status, createdAt });
  }
  const ago = (ms: number) => new Date(h.clock.now().getTime() - ms);
  const keys = async () => (await records().find({ order: { key: 'ASC' } })).map((row) => row.key);

  it('removes completed records past the replay window and keeps the ones inside it', async () => {
    await insert('old', 'completed', ago(IDEMPOTENCY_TTL_MS + 1_000));
    await insert('recent', 'completed', ago(IDEMPOTENCY_TTL_MS - 60_000));

    expect(await janitor().purge()).toBe(1);
    expect(await keys()).toEqual(['recent']);
  });

  it('removes an in_progress claim that was abandoned (a crashed request), but not a live one', async () => {
    await insert('crashed', 'in_progress', ago(IDEMPOTENCY_STALE_CLAIM_MS + 1_000));
    await insert('running', 'in_progress', ago(IDEMPOTENCY_STALE_CLAIM_MS - 60_000));
    // A completed record of the same age is a valid replay, and must stay.
    await insert('answered', 'completed', ago(IDEMPOTENCY_STALE_CLAIM_MS + 1_000));

    expect(await janitor().purge()).toBe(1);
    expect(await keys()).toEqual(['answered', 'running']);
  });

  it('is measured from the injected clock: time passing makes records dead', async () => {
    await insert('fresh', 'completed', h.clock.now());
    expect(await janitor().purge()).toBe(0);

    h.clock.advance(IDEMPOTENCY_TTL_MS + 1_000);
    expect(await janitor().purge()).toBe(1);
    expect(await keys()).toEqual([]);
  });

  it('is idempotent, and does nothing to an empty table', async () => {
    expect(await janitor().purge()).toBe(0);
    await insert('old', 'completed', ago(IDEMPOTENCY_TTL_MS + 1_000));
    expect(await janitor().purge()).toBe(1);
    expect(await janitor().purge()).toBe(0);
  });

  it('leaves every company’s live records alone — it is a time rule, not a tenant rule', async () => {
    const other = (await h.registerAndActivate()).companyId;
    await insert('mine-old', 'completed', ago(IDEMPOTENCY_TTL_MS + 1_000));
    await records().insert({
      companyId: other,
      key: 'theirs-live',
      route: 'POST /files',
      requestHash: 'h',
      status: 'completed',
      createdAt: ago(1_000),
    });

    await janitor().purge();
    expect(await keys()).toEqual(['theirs-live']);
  });

  it('a purged key really is a new request: the same Idempotency-Key runs again instead of being replayed', async () => {
    const admin = await h.registerAndActivate();
    let session = await h.login(admin.email);
    await h.subscribe(session, 'basic');
    const key = 'aaaaaaaa-0000-4000-8000-000000000001';
    const body = 'a,b\n1,2\n';

    const first = await h.upload(session, { idempotencyKey: key, content: body }).expect(201);
    const replay = await h.upload(session, { idempotencyKey: key, content: body }).expect(201);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.id).toBe(first.body.id);

    // The record was stamped by the database's real clock (as in production), so a day later means a day
    // after REAL now, not after the fake clock's starting instant.
    h.clock.set(new Date(Date.now() + IDEMPOTENCY_TTL_MS + 1_000));
    expect(await janitor().purge()).toBeGreaterThan(0);
    session = await h.login(admin.email);
    const again = await h.upload(session, { idempotencyKey: key, content: body }).expect(201);
    expect(again.headers['idempotent-replayed']).toBeUndefined();
    expect(again.body.id).not.toBe(first.body.id);
  });
});
