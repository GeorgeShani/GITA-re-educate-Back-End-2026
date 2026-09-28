import {
  Inject,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PinoLogger } from 'nestjs-pino';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { AuthenticationService } from '#/auth/authentication.service.js';
import { Public } from '#/common/auth/public.decorator.js';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import {
  adminRoom,
  type AuthRefreshAcknowledgement,
  type AuthRefreshResult,
  type ClientToServerEvents,
  companyRoom,
  fileRoom,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  type SocketActionAcknowledgement,
  userRoom,
} from './realtime-events.js';
import { RealtimeAccessService } from './realtime-access.service.js';

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** `io(url, { auth: { token } })` — the same access token the REST API takes as a bearer. */
const handshakeAuth = z.object({ token: z.string().min(1) });
const refreshRequest = z.object({ token: z.string().min(1) });
const SWEEP_INTERVAL_MS = 15_000;
const EXPIRING_WINDOW_MS = 60_000;
const fileAction = z.object({ fileId: z.uuid() });
const typingAction = z.object({ fileId: z.uuid(), isTyping: z.boolean() });
const TYPING_WINDOW_MS = 1_000;
const TYPING_EVENTS_PER_WINDOW = 5;

/**
 * The Socket.IO endpoint. Server events are the product output; the only client commands are
 * token refresh, visibility-checked file watch/unwatch and rate-limited typing presence.
 *
 * - **Authentication happens in a handshake middleware, before the connection exists**, with
 *   the SAME `AuthenticationService` the REST guard uses (so the user row is re-read: a
 *   disabled person or a suspended company cannot connect). A bad or missing token gets a
 *   `connect_error`; nothing is ever joined. Only session tokens work — an API key is an
 *   HTTP integration and is refused here.
 * - **Rooms**: `company:<id>` for everyone, `user:<id>` for the person, `admins:<companyId>`
 *   for admins. Which room an event goes to is decided by `RealtimeEmitter` at EMIT time,
 *   from the current database state, so a file whose access changed is not announced to
 *   someone who lost it.
 * - CORS is open (`origin: true`) because the credential is the explicit `auth.token`, not a
 *   cookie: a page on another origin cannot use anything it does not already hold.
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection<RealtimeSocket>,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: RealtimeServer;
  private sweepTimer: NodeJS.Timeout | undefined;
  private readonly watchedFiles = new Map<string, Set<string>>();
  private readonly typingWindows = new Map<
    string,
    { startedAt: number; count: number }
  >();

  constructor(
    private readonly authentication: AuthenticationService,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly access: RealtimeAccessService,
  ) {
    this.logger.setContext(RealtimeGateway.name);
  }

  onModuleInit(): void {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    this.sweepTimer = setInterval(() => {
      void this.sweep(this.clock.now()).catch((error: unknown) => {
        this.logger.warn({ err: error }, 'Socket expiration sweep failed');
      });
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  afterInit(server: RealtimeServer): void {
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        (error: unknown) => {
          this.logger.info(
            { reason: error instanceof Error ? error.message : 'unknown' },
            'Socket refused',
          );
          next(new Error('Unauthorized'));
        },
      );
    });
  }

  handleConnection(socket: RealtimeSocket): void {
    this.watchedFiles.set(socket.id, new Set());
    void this.joinIdentityRooms(socket);
  }

  handleDisconnect(socket: RealtimeSocket): void {
    const watched = this.watchedFiles.get(socket.id) ?? new Set<string>();
    this.watchedFiles.delete(socket.id);
    this.typingWindows.delete(socket.id);
    for (const fileId of watched) void this.emitPresence(fileId);
  }

  @SubscribeMessage('auth.refresh')
  @Public()
  async refreshSession(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: unknown,
    @Ack() acknowledge: AuthRefreshAcknowledgement,
  ): Promise<void> {
    const now = this.clock.now();
    if (this.isExpired(socket, now)) {
      acknowledge(unauthorizedRefresh());
      this.expire(socket);
      return;
    }

    const parsed = refreshRequest.safeParse(payload);
    if (!parsed.success) {
      acknowledge(unauthorizedRefresh());
      return;
    }

    try {
      const { user, companyStatus, tokenExpiresAt } =
        await this.authentication.authenticate(parsed.data.token);
      if (
        companyStatus !== 'active' ||
        user.userId !== socket.data.userId ||
        user.companyId !== socket.data.companyId
      ) {
        acknowledge(unauthorizedRefresh());
        return;
      }

      await this.leaveIdentityRooms(socket);
      socket.data = {
        userId: user.userId,
        companyId: user.companyId,
        role: user.role,
        expiresAt: tokenExpiresAt,
        expirationWarningSent: false,
      };
      await this.joinIdentityRooms(socket);
      acknowledge({ ok: true, expiresAt: isoTimestamp(tokenExpiresAt) });
    } catch {
      acknowledge(unauthorizedRefresh());
    }
  }

  async sweep(now: Date): Promise<void> {
    if (!this.server) return;
    for (const socket of this.server.sockets.sockets.values()) {
      if (this.isExpired(socket, now)) {
        this.expire(socket);
        continue;
      }
      const remaining = socket.data.expiresAt * 1_000 - now.getTime();
      if (
        remaining <= EXPIRING_WINDOW_MS &&
        !socket.data.expirationWarningSent
      ) {
        socket.data.expirationWarningSent = true;
        socket.emit('session.expiring', {
          expiresAt: isoTimestamp(socket.data.expiresAt),
        });
      }
    }
  }

  @SubscribeMessage('file.watch')
  @Public()
  async watchFile(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: unknown,
    @Ack() acknowledge: SocketActionAcknowledgement,
  ): Promise<void> {
    const parsed = fileAction.safeParse(payload);
    if (
      !parsed.success ||
      this.isExpired(socket, this.clock.now()) ||
      !(await this.access.canViewFile(
        socket.data.companyId,
        parsed.data.fileId,
        {
          userId: socket.data.userId,
          role: socket.data.role,
        },
      ))
    ) {
      acknowledge({ ok: false, error: 'unauthorized' });
      if (this.isExpired(socket, this.clock.now())) this.expire(socket);
      return;
    }
    await socket.join(fileRoom(parsed.data.fileId));
    const watched = this.watchedFiles.get(socket.id) ?? new Set<string>();
    watched.add(parsed.data.fileId);
    this.watchedFiles.set(socket.id, watched);
    acknowledge({ ok: true });
    await this.emitPresence(parsed.data.fileId);
  }

  @SubscribeMessage('file.unwatch')
  @Public()
  async unwatchFile(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: unknown,
    @Ack() acknowledge: SocketActionAcknowledgement,
  ): Promise<void> {
    const parsed = fileAction.safeParse(payload);
    if (!parsed.success || this.isExpired(socket, this.clock.now())) {
      acknowledge({ ok: false, error: 'unauthorized' });
      if (this.isExpired(socket, this.clock.now())) this.expire(socket);
      return;
    }
    await socket.leave(fileRoom(parsed.data.fileId));
    this.watchedFiles.get(socket.id)?.delete(parsed.data.fileId);
    acknowledge({ ok: true });
    await this.emitPresence(parsed.data.fileId);
  }

  @SubscribeMessage('comment.typing')
  @Public()
  async commentTyping(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const parsed = typingAction.safeParse(payload);
    if (
      !parsed.success ||
      this.isExpired(socket, this.clock.now()) ||
      !this.watchedFiles.get(socket.id)?.has(parsed.data.fileId) ||
      !this.allowTyping(socket.id, this.clock.now())
    ) {
      return;
    }
    socket.to(fileRoom(parsed.data.fileId)).emit('comment.typing', {
      fileId: parsed.data.fileId,
      userId: socket.data.userId,
      isTyping: parsed.data.isTyping,
    });
  }

  async evictFileWatchers(fileId: string): Promise<void> {
    if (!this.server) return;
    const sockets = await this.server.in(fileRoom(fileId)).fetchSockets();
    for (const socket of sockets) {
      const mayView = await this.access.canViewFile(
        socket.data.companyId,
        fileId,
        {
          userId: socket.data.userId,
          role: socket.data.role,
        },
      );
      if (!mayView) {
        await socket.leave(fileRoom(fileId));
        this.watchedFiles.get(socket.id)?.delete(fileId);
      }
    }
    await this.emitPresence(fileId);
  }

  private async authenticate(socket: RealtimeSocket): Promise<void> {
    const auth = handshakeAuth.safeParse(socket.handshake.auth);
    if (!auth.success) throw new Error('No token');

    const { user, companyStatus, tokenExpiresAt } =
      await this.authentication.authenticate(auth.data.token);
    if (companyStatus !== 'active') throw new Error('Company is not active');
    socket.data = {
      userId: user.userId,
      companyId: user.companyId,
      role: user.role,
      expiresAt: tokenExpiresAt,
      expirationWarningSent: false,
    };
  }

  private async joinIdentityRooms(socket: RealtimeSocket): Promise<void> {
    const { userId, companyId, role } = socket.data;
    await socket.join([companyRoom(companyId), userRoom(userId)]);
    if (role === 'admin') await socket.join(adminRoom(companyId));
  }

  private async leaveIdentityRooms(socket: RealtimeSocket): Promise<void> {
    const { userId, companyId, role } = socket.data;
    await socket.leave(companyRoom(companyId));
    await socket.leave(userRoom(userId));
    if (role === 'admin') await socket.leave(adminRoom(companyId));
  }

  private isExpired(socket: RealtimeSocket, now: Date): boolean {
    return socket.data.expiresAt * 1_000 <= now.getTime();
  }

  private expire(socket: RealtimeSocket): void {
    socket.emit('session.expired', {
      expiredAt: isoTimestamp(socket.data.expiresAt),
    });
    socket.disconnect(true);
  }

  private allowTyping(socketId: string, now: Date): boolean {
    const current = this.typingWindows.get(socketId);
    if (!current || now.getTime() - current.startedAt >= TYPING_WINDOW_MS) {
      this.typingWindows.set(socketId, { startedAt: now.getTime(), count: 1 });
      return true;
    }
    if (current.count >= TYPING_EVENTS_PER_WINDOW) return false;
    current.count += 1;
    return true;
  }

  private async emitPresence(fileId: string): Promise<void> {
    if (!this.server) return;
    const sockets = await this.server.in(fileRoom(fileId)).fetchSockets();
    const userIds = [
      ...new Set(sockets.map((socket) => socket.data.userId)),
    ].sort();
    this.server
      .to(fileRoom(fileId))
      .emit('presence.changed', { fileId, userIds });
  }
}

function unauthorizedRefresh(): AuthRefreshResult {
  return { ok: false, error: 'unauthorized' };
}

function isoTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toISOString();
}
