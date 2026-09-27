import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { GraphqlLoaderFactory } from './graphql-loaders.js';
import { MAX_QUERY_COMPLEXITY } from './query-limits.js';

const fileSchema = z.object({
  id: z.uuid(),
  datasetId: z.uuid(),
  version: z.number().int(),
  originalName: z.string(),
});
const gqlSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        extensions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});
const fileGraphSchema = z.object({
  file: z
    .object({
      id: z.uuid(),
      uploader: z.object({ id: z.uuid(), fullName: z.string() }),
      report: z.object({
        status: z.string(),
        metrics: z.object({
          rowCount: z.number().int(),
          columns: z.array(
            z.object({ name: z.string(), inferredType: z.string() }),
          ),
        }),
      }),
      versions: z.array(z.object({ id: z.uuid(), version: z.number().int() })),
      commentCount: z.number().int(),
      comments: z.object({
        nodes: z.array(
          z.object({
            body: z.string().nullable(),
            author: z.object({ id: z.uuid() }),
            mentionedUsers: z.array(z.object({ id: z.uuid() })),
          }),
        ),
        pageInfo: z.object({ hasMore: z.boolean(), nextCursor: z.string().nullable() }),
      }),
      grants: z.array(z.object({ id: z.uuid(), fullName: z.string() })).nullable(),
    })
    .nullable(),
});

describe('GraphQL files and reports (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h?.stop());

  async function company() {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, 'basic');
    return { admin, session };
  }

  async function gql(
    token: string,
    query: string,
  ) {
    const response = await h
      .http()
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query });
    return gqlSchema.parse(response.body);
  }

  async function upload(
    session: SessionBody,
    options: Parameters<AppHarness['upload']>[1] = {},
  ) {
    return fileSchema.parse((await h.upload(session, options).expect(201)).body);
  }

  function version(session: SessionBody, fileId: string) {
    return h
      .http()
      .post(`/files/${fileId}/versions`)
      .set(...h.bearer(session))
      .attach('file', Buffer.from(`id,value\n1,${randomUUID()}\n`), {
        filename: 'next.csv',
        contentType: 'text/csv',
      });
  }

  it('matches REST list visibility and cursor ordering', async () => {
    const { session } = await company();
    await upload(session, { name: 'one.csv' });
    await upload(session, { name: 'two.csv' });

    const rest = z
      .object({ data: z.array(fileSchema) })
      .parse(
        (
          await h
            .http()
            .get('/files')
            .set(...h.bearer(session))
            .query({ limit: 1 })
            .expect(200)
        ).body,
      );
    const graph = await gql(
      session.accessToken,
      '{ files(first: 1) { nodes { id datasetId version originalName } pageInfo { hasMore nextCursor } } }',
    );
    const parsed = z
      .object({
        files: z.object({
          nodes: z.array(fileSchema),
          pageInfo: z.object({ hasMore: z.boolean(), nextCursor: z.string().nullable() }),
        }),
      })
      .parse(graph.data);
    expect(parsed.files.nodes).toEqual(rest.data);
    expect(parsed.files.pageInfo.hasMore).toBe(true);

    const second = await gql(
      session.accessToken,
      `{ files(first: 1, after: ${JSON.stringify(parsed.files.pageInfo.nextCursor)}) { nodes { id } } }`,
    );
    expect(second.errors).toBeUndefined();
    expect(JSON.stringify(second.data)).not.toContain(rest.data[0]?.id);
  });

  it('resolves uploader, report, visible versions, comments, comment count, and uploader-visible grants', async () => {
    const { admin, session } = await company();
    const author = await h.inviteAndAccept(session, admin.companyId);
    const grantee = await h.inviteAndAccept(session, admin.companyId);
    const file = await upload(author.session, {
      name: 'accounts.csv',
      content: 'id,amount\n1,10\n2,20\n',
      visibility: 'restricted',
      grantedUserIds: [grantee.userId],
    });
    await version(author.session, file.id).expect(201);
    await h
      .http()
      .post(`/files/${file.id}/comments`)
      .set(...h.bearer(author.session))
      .send({ body: 'Please review', mentionedUserIds: [grantee.userId] })
      .expect(201);
    await h.drainTasks();

    const response = await gql(
      author.session.accessToken,
      `{
        file(id: "${file.id}") {
          id
          uploader { id fullName }
          report { status metrics { rowCount columns { name inferredType } } }
          versions { id version }
          commentCount
          comments(first: 10) {
            nodes { body author { id } mentionedUsers { id } }
            pageInfo { hasMore nextCursor }
          }
          grants { id fullName }
        }
      }`,
    );
    expect(response.errors).toBeUndefined();
    const graph = fileGraphSchema.parse(response.data).file;
    expect(graph?.uploader.id).toBe(author.userId);
    expect(graph?.report).toMatchObject({ status: 'ready', metrics: { rowCount: 2 } });
    expect(graph?.versions.map((item) => item.version)).toEqual([2, 1]);
    expect(graph?.commentCount).toBe(1);
    expect(graph?.comments.nodes[0]).toMatchObject({
      body: 'Please review',
      author: { id: author.userId },
      mentionedUsers: [{ id: grantee.userId }],
    });
    expect(graph?.grants?.map((user) => user.id)).toEqual([grantee.userId]);

    const asGrantee = fileGraphSchema.parse(
      (
        await gql(
          grantee.session.accessToken,
          `{
            file(id: "${file.id}") {
              id uploader { id fullName }
              report { status metrics { rowCount columns { name inferredType } } }
              versions { id version } commentCount
              comments { nodes { body author { id } mentionedUsers { id } } pageInfo { hasMore nextCursor } }
              grants { id fullName }
            }
          }`,
        )
      ).data,
    ).file;
    expect(asGrantee?.grants).toBeNull();
  });

  it('does not reveal a restricted file to a third employee or another tenant', async () => {
    const { admin, session } = await company();
    const owner = await h.inviteAndAccept(session, admin.companyId);
    const outsider = await h.inviteAndAccept(session, admin.companyId);
    const hidden = await upload(owner.session, { visibility: 'restricted' });
    const other = await company();

    for (const token of [outsider.session.accessToken, other.session.accessToken]) {
      const list = await gql(token, '{ files { nodes { id } } }');
      expect(JSON.stringify(list.data)).not.toContain(hidden.id);
      const one = await gql(
        token,
        `{ file(id: "${hidden.id}") { id } }`,
      );
      expect(one.data).toEqual({ file: null });
      expect(one.errors?.[0]?.message).toBe('File not found');
    }
  });

  it('applies visibility to every version instead of trusting the visible parent dataset', async () => {
    const { admin, session } = await company();
    const owner = await h.inviteAndAccept(session, admin.companyId);
    const viewer = await h.inviteAndAccept(session, admin.companyId);
    const first = await upload(owner.session, {
      visibility: 'restricted',
      grantedUserIds: [viewer.userId],
    });
    const second = fileSchema.parse((await version(owner.session, first.id).expect(201)).body);
    await h
      .http()
      .patch(`/files/${first.id}`)
      .set(...h.bearer(owner.session))
      .send({ grantedUserIds: [] })
      .expect(200);

    const response = await gql(
      viewer.session.accessToken,
      `{ file(id: "${second.id}") { id versions { id version } } }`,
    );
    const data = z
      .object({
        file: z.object({
          id: z.uuid(),
          versions: z.array(z.object({ id: z.uuid(), version: z.number().int() })),
        }),
      })
      .parse(response.data);
    expect(data.file.versions).toEqual([{ id: second.id, version: 2 }]);
  });

  it('rejects API keys because the resolver intentionally declares no scopes', async () => {
    const { session } = await company();
    const { key } = await h.createApiKey(session, {
      scopes: ['files:read', 'files:write', 'billing:read'],
    });
    const response = await gql(key, '{ files { nodes { id } } }');
    expect(response.errors?.[0]?.message).toMatch(/API keys cannot be used/);
    expect(response.data ?? null).toBeNull();
  });

  it('batches every relation once, so SQL query count is independent of page size', async () => {
    const { session } = await company();
    for (let index = 0; index < 5; index += 1) await upload(session);

    const factory = h.app.get(GraphqlLoaderFactory);
    const methods = ['users', 'reports', 'grants', 'versions', 'commentCounts'];
    const originals = new Map<string, unknown>();
    const counts = new Map<string, number>();
    for (const method of methods) {
      const original: unknown = Reflect.get(factory, method);
      if (typeof original !== 'function') throw new Error(`Missing loader batch ${method}`);
      originals.set(method, original);
      Reflect.set(factory, method, (...parameters: unknown[]) => {
        counts.set(method, (counts.get(method) ?? 0) + 1);
        return Reflect.apply(original, factory, parameters);
      });
    }
    const query = (first: number) =>
      gql(
        session.accessToken,
        `{ files(first: ${first}) { nodes {
          id uploader { id } report { status } versions { id }
          grants { id } commentCount
        } } }`,
      );
    try {
      await query(1);
      expect(Object.fromEntries(counts)).toEqual({
        users: 1,
        reports: 1,
        grants: 1,
        versions: 1,
        commentCounts: 1,
      });
      counts.clear();
      await query(5);
      expect(Object.fromEntries(counts)).toEqual({
        users: 1,
        reports: 1,
        grants: 1,
        versions: 1,
        commentCounts: 1,
      });
    } finally {
      for (const [method, original] of originals) Reflect.set(factory, method, original);
    }
  });

  it('prices first and nested lists before executing an excessive query', async () => {
    const { session } = await company();
    const response = await gql(
      session.accessToken,
      '{ files(first: 50) { nodes { versions { versions { id } } } } }',
    );
    expect(response.errors?.[0]?.message).toContain(
      `the most allowed is ${MAX_QUERY_COMPLEXITY}`,
    );
    expect(response.errors?.[0]?.extensions).toMatchObject({
      maximum: MAX_QUERY_COMPLEXITY,
    });
    expect(response.data ?? null).toBeNull();
  });
});
