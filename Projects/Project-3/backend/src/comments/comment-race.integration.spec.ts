import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { settle } from '#test/support/socket-client.js';
import { FileComment } from './file-comment.entity.js';

/**
 * An edit checked "is this comment deleted?" BEFORE waiting for the row lock and never again, so a delete that committed
 * while the edit waited was overwritten: the edit wrote a body back onto a comment that had just been deleted.
 * These hold the row lock open to make the interleaving deterministic instead of hoping two requests overlap.
 */
describe('editing a comment that is deleted while the edit waits (integration)', () => {
  let h: AppHarness;
  let author: SessionBody;
  let commentId: string;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    const admin = await h.registerAndActivate();
    const adminSession = await h.login(admin.email);
    await h.subscribe(adminSession, 'basic');
    const employee = await h.inviteAndAccept(adminSession, admin.companyId);
    author = employee.session;
    const file = z.object({ id: z.uuid() }).parse((await h.upload(author).expect(201)).body);
    const created = await h
      .http()
      .post(`/files/${file.id}/comments`)
      .set(...h.bearer(author))
      .send({ body: 'original' })
      .expect(201);
    commentId = z.object({ id: z.uuid() }).parse(created.body).id;
  });
  afterAll(() => h.stop());

  const row = () => h.dataSource.getRepository(FileComment).findOneByOrFail({ id: commentId });

  it('the delete wins: the waiting edit is refused with 409 and writes nothing', async () => {
    const runner = h.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SELECT 1 FROM file_comment WHERE id = $1 FOR UPDATE`, [commentId]);
      let finished = false;
      const pending = h
        .http()
        .patch(`/comments/${commentId}`)
        .set(...h.bearer(author))
        .send({ body: 'edited after the delete' })
        .then((response) => {
          finished = true;
          return response;
        });
      await settle(500);
      expect(finished).toBe(false); // it passed the early check and is now waiting for the lock

      await runner.query(`UPDATE file_comment SET "deletedAt" = now(), body = NULL WHERE id = $1`, [commentId]);
      await runner.commitTransaction();

      const response = await pending;
      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/deleted comment cannot be edited/i);
    } finally {
      await runner.release();
    }

    const stored = await row();
    expect(stored.body).toBeNull();
    expect(stored.deletedAt).not.toBeNull();
    expect(stored.editedAt).toBeNull();
  });

  it('an edit that is not racing anything still works', async () => {
    const response = await h
      .http()
      .patch(`/comments/${commentId}`)
      .set(...h.bearer(author))
      .send({ body: 'edited' })
      .expect(200);

    expect(response.body.body).toBe('edited');
    expect((await row()).editedAt).not.toBeNull();
  });

  it('editing an already-deleted comment is 409 as well', async () => {
    await h.http().delete(`/comments/${commentId}`).set(...h.bearer(author)).expect(200);

    await h.http().patch(`/comments/${commentId}`).set(...h.bearer(author)).send({ body: 'too late' }).expect(409);
    expect((await row()).body).toBeNull();
  });
});
