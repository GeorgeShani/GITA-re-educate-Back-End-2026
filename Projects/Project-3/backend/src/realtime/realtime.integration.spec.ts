import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  AppHarness,
  type RegisteredAccount,
  type SessionBody,
} from '#test/support/app-harness.js';
import { connect, type Listener, settle } from '#test/support/socket-client.js';
import { User } from '#/database/entities/user.entity.js';
import { RealtimeGateway } from './realtime.gateway.js';

/** Statuses of one file, as one client saw them, in order. */
const statusesOf = (listener: Listener, fileId: string): unknown[] =>
  listener
    .of('file.status')
    .filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'fileId' in event &&
        event.fileId === fileId,
    )
    .map((event) =>
      typeof event === 'object' && event !== null && 'status' in event
        ? event.status
        : undefined,
    );

describe('realtime (integration, over a real socket)', () => {
  let h: AppHarness;
  let url: string;
  let open: Listener[];

  let admin: RegisteredAccount;
  let adminSession: SessionBody;
  let uploader: RegisteredAccount & { session: SessionBody };
  let grantee: RegisteredAccount & { session: SessionBody };
  let outsider: RegisteredAccount & { session: SessionBody };

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.app.listen(0);
    const address = h.app.getHttpServer().address();
    if (address === null || typeof address === 'string')
      throw new Error('the app is not listening on a port');
    url = `http://127.0.0.1:${address.port}`;
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    open = [];
    admin = await h.registerAndActivate();
    adminSession = await h.login(admin.email);
    await h.subscribe(adminSession, 'basic');
    uploader = await h.inviteAndAccept(adminSession, admin.companyId);
    grantee = await h.inviteAndAccept(adminSession, admin.companyId);
    outsider = await h.inviteAndAccept(adminSession, admin.companyId);
  });

  afterEach(() => {
    for (const listener of open) listener.close();
  });
  afterAll(() => h.stop());

  async function join(session: SessionBody): Promise<Listener> {
    const listener = await connect(url, session.accessToken);
    open.push(listener);
    return listener;
  }

  describe('the handshake', () => {
    it('refuses a missing, garbage or wrong-kind token, and never connects', async () => {
      await expect(connect(url, undefined)).rejects.toThrow('Unauthorized');
      await expect(connect(url, 'not-a-token')).rejects.toThrow('Unauthorized');
      await expect(
        connect(url, `${adminSession.accessToken}x`),
      ).rejects.toThrow('Unauthorized');
      // The refresh token is opaque, not an access token.
      await expect(connect(url, adminSession.refreshToken)).rejects.toThrow(
        'Unauthorized',
      );

      const { key } = await h.createApiKey(adminSession, {
        scopes: ['files:read'],
      });
      await expect(connect(url, key)).rejects.toThrow('Unauthorized');
    });

    it('accepts a valid session token', async () => {
      const listener = await join(adminSession);
      const gateway = h.app.get(RealtimeGateway);
      const socket = gateway.server.sockets.sockets.get(listener.socket.id ?? '');
      if (!socket) throw new Error('server socket missing');

      expect(listener.socket.connected).toBe(true);
      expect(socket.data.expiresAt).toBe(
        Math.floor(h.clock.now().getTime() / 1_000) + adminSession.expiresIn,
      );
    });

    it('refuses someone who has been disabled, even with a token that is still valid', async () => {
      await h
        .http()
        .delete(`/employees/${outsider.userId}`)
        .set(...h.bearer(adminSession))
        .expect(200);
      await expect(connect(url, outsider.session.accessToken)).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('refuses a suspended company', async () => {
      await h.dataSource.query(
        `UPDATE company SET status = 'suspended' WHERE id = $1`,
        [admin.companyId],
      );
      await expect(connect(url, adminSession.accessToken)).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('drops a removed employee’s open socket the moment they are removed', async () => {
      const listener = await join(outsider.session);
      const closed = new Promise<void>((resolve) =>
        listener.socket.once('disconnect', () => resolve()),
      );

      await h
        .http()
        .delete(`/employees/${outsider.userId}`)
        .set(...h.bearer(adminSession))
        .expect(200);
      await closed;
      expect(listener.socket.connected).toBe(false);
    });
  });

  describe('session lifecycle', () => {
    it('warns once in the final minute, then announces expiry and disconnects', async () => {
      const listener = await join(adminSession);
      const gateway = h.app.get(RealtimeGateway);
      const issuedAt = h.clock.now().getTime();

      h.clock.set(new Date(issuedAt + adminSession.expiresIn * 1_000 - 59_000));
      await gateway.sweep(h.clock.now());
      await listener.waitFor('session.expiring');
      await gateway.sweep(h.clock.now());
      expect(listener.of('session.expiring')).toHaveLength(1);

      const disconnected = new Promise<void>((resolve) =>
        listener.socket.once('disconnect', () => resolve()),
      );
      h.clock.advance(60_000);
      await gateway.sweep(h.clock.now());
      await listener.waitFor('session.expired');
      await disconnected;

      expect(listener.socket.connected).toBe(false);
    });

    it('refreshes only the same active user and rebuilds role rooms', async () => {
      const listener = await join(adminSession);
      const gateway = h.app.get(RealtimeGateway);
      h.clock.advance(5 * 60_000);
      await h.dataSource.query(
        `UPDATE "user" SET role = 'employee' WHERE id = $1`,
        [admin.userId],
      );
      const replacement = await h.login(admin.email);

      const result = await listener.refresh(replacement.accessToken);
      expect(result.ok).toBe(true);

      const socket = gateway.server.sockets.sockets.get(listener.socket.id ?? '');
      if (!socket) throw new Error('server socket missing');
      expect(socket.data.role).toBe('employee');
      expect(socket.rooms.has(`admins:${admin.companyId}`)).toBe(false);
      expect(socket.rooms.has(`company:${admin.companyId}`)).toBe(true);
      expect(socket.rooms.has(`user:${admin.userId}`)).toBe(true);
    });

    it('rejects another user, API keys, and a suspended company', async () => {
      const listener = await join(adminSession);
      const { key } = await h.createApiKey(adminSession, {
        scopes: ['files:read'],
      });

      expect(await listener.refresh(outsider.session.accessToken)).toEqual({
        ok: false,
        error: 'unauthorized',
      });
      expect(await listener.refresh(key)).toEqual({
        ok: false,
        error: 'unauthorized',
      });

      await h.dataSource.query(
        `UPDATE company SET status = 'suspended' WHERE id = $1`,
        [admin.companyId],
      );
      expect(await listener.refresh(adminSession.accessToken)).toEqual({
        ok: false,
        error: 'unauthorized',
      });
      expect(listener.socket.connected).toBe(true);
    });

    it('rejects an expired replacement while the refreshed socket remains valid', async () => {
      const listener = await join(adminSession);
      const original = adminSession.accessToken;

      h.clock.advance(5 * 60_000);
      const replacement = await h.login(admin.email);
      expect((await listener.refresh(replacement.accessToken)).ok).toBe(true);

      h.clock.advance(11 * 60_000);
      expect(await listener.refresh(original)).toEqual({
        ok: false,
        error: 'unauthorized',
      });
      expect(listener.socket.connected).toBe(true);
    });

    it('cannot refresh after the socket session itself has expired', async () => {
      const listener = await join(adminSession);

      h.clock.advance(5 * 60_000);
      const replacement = await h.login(admin.email);
      h.clock.advance(11 * 60_000);

      const disconnected = new Promise<void>((resolve) =>
        listener.socket.once('disconnect', () => resolve()),
      );
      expect(await listener.refresh(replacement.accessToken)).toEqual({
        ok: false,
        error: 'unauthorized',
      });
      await disconnected;
      expect(listener.socket.connected).toBe(false);
    });
  });

  describe('file.status', () => {
    it('a company-visible file’s progress reaches everyone in the company, in order, and nobody else', async () => {
      const other = await h.registerAndActivate();
      const otherSession = await h.login(other.email);
      await h.subscribe(otherSession, 'basic');
      const [asAdmin, asUploader, asOutsider, asStranger] = await Promise.all([
        join(adminSession),
        join(uploader.session),
        join(outsider.session),
        join(otherSession),
      ]);

      const uploaded = await h.upload(uploader.session).expect(201);
      const fileId: string = uploaded.body.id;
      await h.drainTasks();

      for (const listener of [asAdmin, asUploader, asOutsider]) {
        await listener.waitFor('file.status', 3);
        expect(statusesOf(listener, fileId)).toEqual([
          'queued',
          'profiling',
          'ready',
        ]);
      }
      await settle();
      expect(asStranger.of('file.status')).toEqual([]);
    });

    it('a restricted file’s progress reaches the admin, the uploader and the granted person — not the rest', async () => {
      const [asAdmin, asUploader, asGrantee, asOutsider] = await Promise.all([
        join(adminSession),
        join(uploader.session),
        join(grantee.session),
        join(outsider.session),
      ]);

      const uploaded = await h
        .upload(uploader.session, {
          visibility: 'restricted',
          grantedUserIds: [grantee.userId],
        })
        .expect(201);
      const fileId: string = uploaded.body.id;
      await h.drainTasks();

      for (const listener of [asAdmin, asUploader, asGrantee]) {
        await listener.waitFor('file.status', 3);
        expect(statusesOf(listener, fileId)).toEqual([
          'queued',
          'profiling',
          'ready',
        ]);
      }
      await settle();
      expect(asOutsider.of('file.status')).toEqual([]);
    });

    it('the audience follows the file’s CURRENT access: widening it to the company tells the company', async () => {
      const [asUploader, asOutsider] = await Promise.all([
        join(uploader.session),
        join(outsider.session),
      ]);

      const uploaded = await h
        .upload(uploader.session, { visibility: 'restricted' })
        .expect(201);
      const fileId: string = uploaded.body.id;
      await asUploader.waitFor('file.status', 1);
      await settle(150);
      expect(asOutsider.of('file.status')).toEqual([]);

      await h
        .http()
        .patch(`/files/${fileId}`)
        .set(...h.bearer(uploader.session))
        .send({ visibility: 'company' })
        .expect(200);
      await h.drainTasks();

      await asOutsider.waitFor('file.status', 2);
      expect(statusesOf(asOutsider, fileId)).toEqual(['profiling', 'ready']);
    });

    it('is emitted only after the upload has committed: a client that reads on the event finds the file', async () => {
      const asAdmin = await join(adminSession);
      const readsOnEvent = new Promise<number>((resolve) => {
        asAdmin.socket.once('file.status', (event: { fileId: string }) => {
          void h
            .http()
            .get(`/files/${event.fileId}`)
            .set(...h.bearer(adminSession))
            .then((response) => resolve(response.status));
        });
      });

      await h.upload(uploader.session).expect(201);
      expect(await readsOnEvent).toBe(200);
    });

    it('a failing emit never fails the upload', async () => {
      const gateway = h.app.get(RealtimeGateway);
      const original = gateway.server.to.bind(gateway.server);
      gateway.server.to = () => {
        throw new Error('the socket layer is down');
      };
      try {
        await h.upload(uploader.session).expect(201);
      } finally {
        gateway.server.to = original;
      }
    });
  });

  describe('quota.updated', () => {
    it('reaches the whole company after each upload, with the plan’s numbers, and no other company', async () => {
      const other = await h.registerAndActivate();
      const otherSession = await h.login(other.email);
      const [asAdmin, asOutsider, asStranger] = await Promise.all([
        join(adminSession),
        join(outsider.session),
        join(otherSession),
      ]);

      await h
        .upload(uploader.session, { visibility: 'restricted' })
        .expect(201);
      await h.upload(uploader.session).expect(201);

      for (const listener of [asAdmin, asOutsider]) {
        await listener.waitFor('quota.updated', 2);
        expect(listener.of('quota.updated')).toMatchObject([
          { plan: 'basic', filesUsed: 1, filesLimit: 100 },
          { plan: 'basic', filesUsed: 2, filesLimit: 100 },
        ]);
      }
      await settle();
      expect(asStranger.of('quota.updated')).toEqual([]);
    });

    it('is not sent for an upload that was refused', async () => {
      const asAdmin = await join(adminSession);
      await h
        .upload(uploader.session, {
          content: 'MZ\u0090\u0000not a spreadsheet',
          name: 'x.csv',
        })
        .expect(400);
      await settle();
      expect(asAdmin.of('quota.updated')).toEqual([]);
      expect(asAdmin.of('file.status')).toEqual([]);
    });
  });

  describe('audit.appended', () => {
    it('goes to admins only, without the entry’s metadata', async () => {
      const [asAdmin, asEmployee] = await Promise.all([
        join(adminSession),
        join(outsider.session),
      ]);

      const uploaded = await h
        .upload(uploader.session, { name: 'secret-plans.csv' })
        .expect(201);

      await asAdmin.waitFor('audit.appended', 1);
      expect(asAdmin.of('audit.appended')).toMatchObject([
        {
          action: 'file.uploaded',
          actorUserId: uploader.userId,
          targetType: 'file',
          targetId: uploaded.body.id,
        },
      ]);
      expect(JSON.stringify(asAdmin.of('audit.appended'))).not.toContain(
        'secret-plans',
      );
      await settle();
      expect(asEmployee.of('audit.appended')).toEqual([]);
    });

    it('is not sent for a transaction that rolled back', async () => {
      const asAdmin = await join(adminSession);
      // A grant to someone who is not a member makes the upload fail AFTER validation but
      // before it commits anything; its audit entry (if any) never existed.
      await h
        .upload(uploader.session, {
          visibility: 'restricted',
          grantedUserIds: ['00000000-0000-4000-8000-000000000000'],
        })
        .expect((response) => {
          expect(response.status).toBeGreaterThanOrEqual(400);
        });
      await settle();
      expect(asAdmin.of('audit.appended')).toEqual([]);
    });

    it('carries the wider trail too: inviting and removing people', async () => {
      const asAdmin = await join(adminSession);
      await h
        .http()
        .delete(`/employees/${outsider.userId}`)
        .set(...h.bearer(adminSession))
        .expect(200);

      await asAdmin.waitFor('audit.appended', 1);
      expect(asAdmin.of('audit.appended')).toMatchObject([
        { action: 'employee.disabled', targetId: outsider.userId },
      ]);
      expect(
        await h.dataSource
          .getRepository(User)
          .countBy({ id: outsider.userId, status: 'disabled' }),
      ).toBe(1);
    });
  });
});
