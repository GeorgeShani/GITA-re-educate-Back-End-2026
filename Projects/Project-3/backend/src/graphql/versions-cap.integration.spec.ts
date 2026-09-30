import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { MAX_VERSIONS_PER_FILE } from './graphql-loaders.js';

const VERSIONS = MAX_VERSIONS_PER_FILE + 6;

/**
 * The cost of a `versions` field is priced as if it returned {@link MAX_VERSIONS_PER_FILE} rows, but it used to return
 * every version: a Premium file with hundreds returned far more than it was charged for.
 */
describe('GraphQL versions stay within what they are priced at (integration)', () => {
  let h: AppHarness;
  let session: SessionBody;
  let firstId: string;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    const admin = await h.registerAndActivate();
    session = await h.login(admin.email);
    await h.subscribe(session, 'basic');
    firstId = z.object({ id: z.uuid() }).parse((await h.upload(session).expect(201)).body).id;
    // Many versions of one file, inserted directly: what is under test is the read side, not 56 uploads.
    await h.dataSource.query(
      `INSERT INTO file_asset (id, "datasetId", "companyId", "uploaderId", "originalName", "mimeType", "sizeBytes", "storageKey", visibility, version, "isLatest", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), f."datasetId", f."companyId", f."uploaderId", f."originalName", f."mimeType", f."sizeBytes",
              'seeded/' || gen_random_uuid(), f.visibility, n, n = $2, now(), now()
       FROM file_asset f, generate_series(2, $2) AS n WHERE f.id = $1`,
      [firstId, VERSIONS],
    );
    await h.dataSource.query(`UPDATE file_asset SET "isLatest" = false WHERE id = $1`, [firstId]);
  });
  afterAll(() => h.stop());

  async function versionsThroughGraphql(): Promise<number[]> {
    const response = await h
      .http()
      .post('/graphql')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ query: `{ file(id: "${firstId}") { versions { version } } }` })
      .expect(200);
    const body = z
      .object({ data: z.object({ file: z.object({ versions: z.array(z.object({ version: z.number().int() })) }) }) })
      .parse(response.body);
    return body.data.file.versions.map((entry) => entry.version);
  }

  it(`returns at most ${MAX_VERSIONS_PER_FILE} versions, the newest first`, async () => {
    const versions = await versionsThroughGraphql();

    expect(versions).toHaveLength(MAX_VERSIONS_PER_FILE);
    expect(versions[0]).toBe(VERSIONS);
    expect(versions.at(-1)).toBe(VERSIONS - MAX_VERSIONS_PER_FILE + 1);
    expect(versions).toEqual([...versions].sort((a, b) => b - a));
  });

  it('the whole history is still one paginated REST call away', async () => {
    const response = await h
      .http()
      .get(`/files/${firstId}/versions`)
      .set(...h.bearer(session))
      .query({ limit: 100 })
      .expect(200);

    expect(response.body.meta.total).toBe(VERSIONS);
    expect(response.body.data).toHaveLength(VERSIONS);
  });

  it('a file with fewer versions than the cap returns all of them', async () => {
    const other = z.object({ id: z.uuid() }).parse((await h.upload(session).expect(201)).body).id;
    const response = await h
      .http()
      .post('/graphql')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ query: `{ file(id: "${other}") { versions { version } } }` })
      .expect(200);

    expect(response.body.data.file.versions).toEqual([{ version: 1 }]);
  });
});
