import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { connect, type Listener } from '#test/support/socket-client.js';
import { MAX_WATCHED_FILES_PER_SOCKET } from './realtime.gateway.js';

/**
 * `file.watch` costs a database read and a presence broadcast to the whole room, and Socket.IO events do not pass
 * the HTTP throttler, so an authenticated user used to be able to spam it without limit.
 */
describe('file.watch limits (integration, over a real socket)', () => {
  let h: AppHarness;
  let url: string;
  let open: Listener[];
  let session: SessionBody;
  let fileIds: string[];

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.app.listen(0);
    const address = h.app.getHttpServer().address();
    if (address === null || typeof address === 'string') throw new Error('the app is not listening on a port');
    url = `http://127.0.0.1:${address.port}`;
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    open = [];
    const admin = await h.registerAndActivate();
    session = await h.login(admin.email);
    await h.subscribe(session, 'basic');
    fileIds = [];
    for (let i = 0; i < MAX_WATCHED_FILES_PER_SOCKET + 1; i += 1) {
      const response = await h.upload(session).expect(201);
      fileIds.push(z.object({ id: z.uuid() }).parse(response.body).id);
    }
  });
  afterEach(() => {
    for (const listener of open) listener.close();
  });
  afterAll(() => h.stop());

  async function join(): Promise<Listener> {
    const listener = await connect(url, session.accessToken);
    open.push(listener);
    return listener;
  }

  /** The window the limiter counts in is the app clock's, so a test moves on to a new window by advancing it. */
  const nextWindow = () => h.clock.advance(11_000);

  it(`lets a socket follow ${MAX_WATCHED_FILES_PER_SOCKET} files and refuses the next`, async () => {
    const socket = await join();
    const first = fileIds.slice(0, MAX_WATCHED_FILES_PER_SOCKET);
    const extra = fileIds[MAX_WATCHED_FILES_PER_SOCKET] ?? '';

    for (const fileId of first) expect(await socket.watch(fileId)).toEqual({ ok: true });
    nextWindow();

    expect(await socket.watch(extra)).toEqual({ ok: false, error: 'too_many_files' });
  });

  it('watching a file already followed is not a new one, even at the limit', async () => {
    const socket = await join();
    const first = fileIds.slice(0, MAX_WATCHED_FILES_PER_SOCKET);
    for (const fileId of first) await socket.watch(fileId);
    nextWindow();

    expect(await socket.watch(first[0] ?? '')).toEqual({ ok: true });
  });

  it('unwatching frees a slot', async () => {
    const socket = await join();
    const first = fileIds.slice(0, MAX_WATCHED_FILES_PER_SOCKET);
    const extra = fileIds[MAX_WATCHED_FILES_PER_SOCKET] ?? '';
    for (const fileId of first) await socket.watch(fileId);
    nextWindow();
    expect(await socket.watch(extra)).toEqual({ ok: false, error: 'too_many_files' });

    expect(await socket.unwatch(first[0] ?? '')).toEqual({ ok: true });
    expect(await socket.watch(extra)).toEqual({ ok: true });
  });

  it('the limit is per socket: another tab follows its own set', async () => {
    const one = await join();
    const two = await join();
    for (const fileId of fileIds.slice(0, MAX_WATCHED_FILES_PER_SOCKET)) await one.watch(fileId);
    nextWindow();

    expect(await two.watch(fileIds[MAX_WATCHED_FILES_PER_SOCKET] ?? '')).toEqual({ ok: true });
  });

  it('refuses a burst of commands with rate_limited, and accepts them again in the next window', async () => {
    const socket = await join();
    const fileId = fileIds[0] ?? '';

    const answers: unknown[] = [];
    for (let i = 0; i < 25; i += 1) answers.push(await socket.watch(fileId));

    expect(answers.slice(0, 20).every((answer) => JSON.stringify(answer) === JSON.stringify({ ok: true }))).toBe(true);
    expect(answers.slice(20)).toEqual(Array.from({ length: 5 }, () => ({ ok: false, error: 'rate_limited' })));

    nextWindow();
    expect(await socket.watch(fileId)).toEqual({ ok: true });
  });

  it('unwatch commands count against the same window', async () => {
    const socket = await join();
    const fileId = fileIds[0] ?? '';
    for (let i = 0; i < 20; i += 1) await socket.unwatch(fileId);

    expect(await socket.unwatch(fileId)).toEqual({ ok: false, error: 'rate_limited' });
    expect(await socket.watch(fileId)).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('a file that does not exist is refused as unauthorized, not silently accepted', async () => {
    const socket = await join();

    expect(await socket.watch('00000000-0000-4000-8000-000000000000')).toEqual({ ok: false, error: 'unauthorized' });
  });
});
