import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { connect, type Listener, settle } from '#test/support/socket-client.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import { Notification } from '#/notifications/notification.entity.js';
import { FileCommentMention } from './file-comment-mention.entity.js';

const commentSchema = z.object({
  id: z.uuid(),
  fileId: z.uuid(),
  parentId: z.uuid().nullable(),
  body: z.string().nullable(),
  author: z.object({ id: z.uuid(), fullName: z.string() }),
  mentionedUsers: z.array(z.object({ id: z.uuid(), fullName: z.string() })),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
});

describe('file comments, mentions and presence (integration)', () => {
  let h: AppHarness;
  let url: string;
  let listeners: Listener[];

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.app.listen(0);
    const address = h.app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('the app is not listening on a port');
    }
    url = `http://127.0.0.1:${address.port}`;
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    listeners = [];
  });

  afterEach(() => {
    for (const listener of listeners) listener.close();
  });

  afterAll(() => h.stop());

  async function setup() {
    const admin = await h.registerAndActivate();
    const adminSession = await h.login(admin.email);
    await h.subscribe(adminSession, 'basic');
    const author = await h.inviteAndAccept(adminSession, admin.companyId);
    const colleague = await h.inviteAndAccept(adminSession, admin.companyId);
    const outsider = await h.inviteAndAccept(adminSession, admin.companyId);
    const uploaded = await h.upload(author.session).expect(201);
    const file = z.object({ id: z.uuid() }).parse(uploaded.body);
    return { admin, adminSession, author, colleague, outsider, file };
  }

  async function create(
    session: SessionBody,
    fileId: string,
    body: string,
    options: { parentId?: string; mentionedUserIds?: string[] } = {},
  ) {
    const response = await h
      .http()
      .post(`/files/${fileId}/comments`)
      .set(...h.bearer(session))
      .send({ body, ...options })
      .expect(201);
    return commentSchema.parse(response.body);
  }

  async function join(session: SessionBody): Promise<Listener> {
    const listener = await connect(url, session.accessToken);
    listeners.push(listener);
    return listener;
  }

  it('creates, lists and keyset-paginates a one-level thread', async () => {
    const { author, colleague, file } = await setup();
    const root = await create(author.session, file.id, 'Root');
    const reply = await create(colleague.session, file.id, 'Reply', {
      parentId: root.id,
    });

    await h
      .http()
      .post(`/files/${file.id}/comments`)
      .set(...h.bearer(author.session))
      .send({ body: 'Too deep', parentId: reply.id })
      .expect(422);

    const first = await h
      .http()
      .get(`/files/${file.id}/comments`)
      .set(...h.bearer(author.session))
      .query({ limit: 1 })
      .expect(200);
    const page = z
      .object({
        data: z.array(commentSchema),
        meta: z.object({
          nextCursor: z.string().nullable(),
          hasMore: z.boolean(),
        }),
      })
      .parse(first.body);
    expect(page.data.map((comment) => comment.id)).toEqual([root.id]);
    expect(page.meta.hasMore).toBe(true);

    const second = await h
      .http()
      .get(`/files/${file.id}/comments`)
      .set(...h.bearer(author.session))
      .query({ limit: 1, cursor: page.meta.nextCursor })
      .expect(200);
    expect(
      z.object({ data: z.array(commentSchema) }).parse(second.body).data[0]?.id,
    ).toBe(reply.id);
  });

  it('uses file visibility for every operation and never turns a mention into access', async () => {
    const { author, colleague, outsider, file } = await setup();
    await h
      .http()
      .patch(`/files/${file.id}`)
      .set(...h.bearer(author.session))
      .send({ visibility: 'restricted', grantedUserIds: [colleague.userId] })
      .expect(200);

    const comment = await create(
      author.session,
      file.id,
      'For the project team',
      {
        mentionedUserIds: [colleague.userId],
      },
    );
    expect(comment.mentionedUsers.map((user) => user.id)).toEqual([
      colleague.userId,
    ]);
    expect(
      await h.dataSource.getRepository(FileAccessGrant).countBy({
        fileId: file.id,
        userId: outsider.userId,
      }),
    ).toBe(0);

    await h
      .http()
      .post(`/files/${file.id}/comments`)
      .set(...h.bearer(author.session))
      .send({
        body: 'Cannot mention hidden people',
        mentionedUserIds: [outsider.userId],
      })
      .expect(422);
    await h
      .http()
      .get(`/files/${file.id}/comments`)
      .set(...h.bearer(outsider.session))
      .expect(404);
    await h
      .http()
      .patch(`/comments/${comment.id}`)
      .set(...h.bearer(outsider.session))
      .send({ body: 'Nope' })
      .expect(404);
  });

  it('notifies only newly mentioned people and never stores comment text in audit metadata', async () => {
    const { author, colleague, outsider, file } = await setup();
    const comment = await create(
      author.session,
      file.id,
      'Sensitive launch notes',
      {
        mentionedUserIds: [colleague.userId],
      },
    );

    await h
      .http()
      .patch(`/comments/${comment.id}`)
      .set(...h.bearer(author.session))
      .send({
        body: 'Sensitive launch notes, revised',
        mentionedUserIds: [colleague.userId, outsider.userId],
      })
      .expect(200);

    const notifications = await h.dataSource.getRepository(Notification).find({
      where: { type: 'comment.mentioned' },
      order: { createdAt: 'ASC' },
    });
    expect(notifications.map((row) => row.userId)).toEqual([
      colleague.userId,
      outsider.userId,
    ]);

    const audit = await h.dataSource.getRepository(AuditLogEntry).find({
      where: { targetId: comment.id },
    });
    expect(audit.map((row) => row.action).sort()).toEqual([
      'comment.created',
      'comment.updated',
    ]);
    expect(JSON.stringify(audit.map((row) => row.metadata))).not.toContain(
      'Sensitive',
    );
  });

  it('allows authors to edit, authors or admins to delete, and keeps a bodyless tombstone', async () => {
    const { adminSession, author, colleague, file } = await setup();
    const comment = await create(author.session, file.id, 'Remove me', {
      mentionedUserIds: [colleague.userId],
    });

    await h
      .http()
      .patch(`/comments/${comment.id}`)
      .set(...h.bearer(colleague.session))
      .send({ body: 'Not mine' })
      .expect(403);
    const deleted = await h
      .http()
      .delete(`/comments/${comment.id}`)
      .set(...h.bearer(adminSession))
      .expect(200);
    expect(commentSchema.parse(deleted.body)).toMatchObject({
      id: comment.id,
      body: null,
      mentionedUsers: [],
    });
    expect(
      await h.dataSource
        .getRepository(FileCommentMention)
        .countBy({ commentId: comment.id }),
    ).toBe(0);

    const listed = await h
      .http()
      .get(`/files/${file.id}/comments`)
      .set(...h.bearer(author.session))
      .expect(200);
    expect(
      z.object({ data: z.array(commentSchema) }).parse(listed.body).data[0],
    ).toMatchObject({
      id: comment.id,
      body: null,
    });
  });

  it('lets read-scoped API keys list comments but denies every mutation', async () => {
    const { author, file } = await setup();
    const comment = await create(
      author.session,
      file.id,
      'Readable through integration',
    );
    const key = await h.createApiKey(author.session, {
      scopes: ['files:read'],
    });
    const bearer: [string, string] = ['Authorization', `Bearer ${key.key}`];

    await h
      .http()
      .get(`/files/${file.id}/comments`)
      .set(...bearer)
      .expect(200);
    await h
      .http()
      .post(`/files/${file.id}/comments`)
      .set(...bearer)
      .send({ body: 'No writes' })
      .expect(403);
    await h
      .http()
      .patch(`/comments/${comment.id}`)
      .set(...bearer)
      .send({ body: 'No writes' })
      .expect(403);
    await h
      .http()
      .delete(`/comments/${comment.id}`)
      .set(...bearer)
      .expect(403);
  });

  it('pushes committed comment events only to people who can currently see the file', async () => {
    const { author, colleague, outsider, file } = await setup();
    await h
      .http()
      .patch(`/files/${file.id}`)
      .set(...h.bearer(author.session))
      .send({ visibility: 'restricted', grantedUserIds: [colleague.userId] })
      .expect(200);
    const allowed = await join(colleague.session);
    const hidden = await join(outsider.session);

    const comment = await create(author.session, file.id, 'Live update');
    expect((await allowed.waitFor('comment.created'))[0]).toMatchObject({
      id: comment.id,
    });
    await settle();
    expect(hidden.of('comment.created')).toEqual([]);

    await h
      .http()
      .patch(`/comments/${comment.id}`)
      .set(...h.bearer(author.session))
      .send({ body: 'Live update two' })
      .expect(200);
    expect((await allowed.waitFor('comment.updated'))[0]).toMatchObject({
      id: comment.id,
    });
  });

  it('deduplicates presence across tabs and rate-limits typing events per socket', async () => {
    const { author, colleague, file } = await setup();
    const first = await join(author.session);
    const second = await join(author.session);
    const colleagueSocket = await join(colleague.session);

    expect(await first.watch(file.id)).toEqual({ ok: true });
    expect(await second.watch(file.id)).toEqual({ ok: true });
    expect(await colleagueSocket.watch(file.id)).toEqual({ ok: true });
    const presence = await first.waitFor('presence.changed', 3);
    expect(presence.at(-1)).toMatchObject({
      fileId: file.id,
      userIds: [author.userId, colleague.userId].sort(),
    });

    for (let count = 0; count < 7; count += 1) first.typing(file.id, true);
    await colleagueSocket.waitFor('comment.typing', 5);
    await settle();
    expect(colleagueSocket.of('comment.typing')).toHaveLength(5);

    expect(await second.unwatch(file.id)).toEqual({ ok: true });
    const afterUnwatch = await first.waitFor('presence.changed', 4);
    expect(afterUnwatch.at(-1)).toMatchObject({
      userIds: [author.userId, colleague.userId].sort(),
    });
  });

  it('evicts watchers immediately when file access is removed', async () => {
    const { author, colleague, file } = await setup();
    await h
      .http()
      .patch(`/files/${file.id}`)
      .set(...h.bearer(author.session))
      .send({ visibility: 'restricted', grantedUserIds: [colleague.userId] })
      .expect(200);
    const owner = await join(author.session);
    const removed = await join(colleague.session);
    await owner.watch(file.id);
    await removed.watch(file.id);

    await h
      .http()
      .patch(`/files/${file.id}`)
      .set(...h.bearer(author.session))
      .send({ grantedUserIds: [] })
      .expect(200);
    await owner.waitFor('presence.changed', 3);
    removed.typing(file.id, true);
    await settle();
    expect(owner.of('comment.typing')).toEqual([]);
    await h
      .http()
      .get(`/files/${file.id}/comments`)
      .set(...h.bearer(colleague.session))
      .expect(404);
  });
});
