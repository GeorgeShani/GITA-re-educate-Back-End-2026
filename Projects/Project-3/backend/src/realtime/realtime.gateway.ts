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
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  userRoom,
} from './realtime-events.js';

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

/**
 * The Socket.IO endpoint. It is push-only: clients connect, are put in rooms, and listen.
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
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: RealtimeServer;
  private sweepTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly authentication: AuthenticationService,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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
    void this.joinIdentityRooms(socket);
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
}

function unauthorizedRefresh(): AuthRefreshResult {
  return { ok: false, error: 'unauthorized' };
}

function isoTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toISOString();
}
