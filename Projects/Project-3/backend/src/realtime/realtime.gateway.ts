import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PinoLogger } from 'nestjs-pino';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { AuthenticationService } from '#/auth/authentication.service.js';
import {
  adminRoom,
  type ClientToServerEvents,
  companyRoom,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  userRoom,
} from './realtime-events.js';

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** `io(url, { auth: { token } })` — the same access token the REST API takes as a bearer. */
const handshakeAuth = z.object({ token: z.string().min(1) });

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
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection<RealtimeSocket> {
  @WebSocketServer()
  server!: RealtimeServer;

  constructor(
    private readonly authentication: AuthenticationService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RealtimeGateway.name);
  }

  afterInit(server: RealtimeServer): void {
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        (error: unknown) => {
          this.logger.info({ reason: error instanceof Error ? error.message : 'unknown' }, 'Socket refused');
          next(new Error('Unauthorized'));
        },
      );
    });
  }

  handleConnection(socket: RealtimeSocket): void {
    const { userId, companyId, role } = socket.data;
    void socket.join([companyRoom(companyId), userRoom(userId)]);
    if (role === 'admin') void socket.join(adminRoom(companyId));
  }

  private async authenticate(socket: RealtimeSocket): Promise<void> {
    const auth = handshakeAuth.safeParse(socket.handshake.auth);
    if (!auth.success) throw new Error('No token');

    const { user, companyStatus } = await this.authentication.authenticate(auth.data.token);
    if (companyStatus !== 'active') throw new Error('Company is not active');
    socket.data = { userId: user.userId, companyId: user.companyId, role: user.role };
  }
}
