import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness } from '#test/support/app-harness.js';
import { FileAsset } from './file-asset.entity.js';
import { ORPHAN_GRACE_MS, OrphanedObjectsJanitor } from './orphaned-objects-janitor.service.js';

describe('the orphaned-objects janitor (integration)', () => {
  let h: AppHarness;
  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  const exists = async (key: string) => {
    try {
      await h.storage.get(key);
      return true;
    } catch {
      return false;
    }
  };

  async function setup() {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, 'free');
    const { id } = z.object({ id: z.uuid() }).parse((await h.upload(session).expect(201)).body);
    const file = await h.dataSource.getRepository(FileAsset).findOneByOrFail({ id });
    return { admin, session, file };
  }

  it('removes bytes that no file row points to, and only those', async () => {
    const { admin, file } = await setup();
    const orphan = `companies/${admin.companyId}/files/${randomUUID()}`;
    await h.storage.put(orphan, Buffer.from('a,b\n1,2\n'));
    const janitor = h.app.get(OrphanedObjectsJanitor);
    const longAfter = new Date(Date.now() + ORPHAN_GRACE_MS + 60_000);

    expect(await janitor.purge(longAfter)).toBe(1);

    expect(await exists(orphan)).toBe(false);
    expect(await exists(file.storageKey)).toBe(true);
    expect(await janitor.purge(longAfter)).toBe(0);
  });

  it('leaves a young object alone: its row may still be on its way', async () => {
    const { admin } = await setup();
    const fresh = `companies/${admin.companyId}/files/${randomUUID()}`;
    await h.storage.put(fresh, Buffer.from('a\n1\n'));

    expect(await h.app.get(OrphanedObjectsJanitor).purge(new Date())).toBe(0);
    expect(await exists(fresh)).toBe(true);
  });

  it('never mistakes a soft-deleted file for an orphan: its row still names the key', async () => {
    const { session, file } = await setup();
    await h.http().delete(`/files/${file.id}`).set(...h.bearer(session)).expect(200);
    // Deleting a file removes its bytes; put some back under the same key to see whether the row alone protects them.
    await h.storage.put(file.storageKey, Buffer.from('a\n1\n'));

    expect(await h.app.get(OrphanedObjectsJanitor).purge(new Date(Date.now() + ORPHAN_GRACE_MS + 60_000))).toBe(0);
    expect(await exists(file.storageKey)).toBe(true);
  });
});
