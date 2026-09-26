import { io, type Socket } from 'socket.io-client';
import type {
  AuthRefreshResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketActionResult,
} from '#/realtime/realtime-events.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** A connected client that records every event it is pushed, in order. */
export interface Listener {
  socket: ClientSocket;
  /** `[event, payload]` in arrival order. */
  events: Array<[string, unknown]>;
  /** Payloads of one event, in arrival order. */
  of(event: string): unknown[];
  /** Resolves once `count` events named `event` have arrived (rejects after `timeoutMs`). */
  waitFor(
    event: string,
    count?: number,
    timeoutMs?: number,
  ): Promise<unknown[]>;
  refresh(token: string): Promise<AuthRefreshResult>;
  watch(fileId: string): Promise<SocketActionResult>;
  unwatch(fileId: string): Promise<SocketActionResult>;
  typing(fileId: string, isTyping: boolean): void;
  close(): void;
}

const OBSERVED = [
  'file.status',
  'quota.updated',
  'audit.appended',
  'notification.created',
  'session.expiring',
  'session.expired',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'comment.typing',
  'presence.changed',
] as const;

/**
 * Connects to the running app the way a browser would: `io(url, { auth: { token } })`, WebSocket
 * only, no reconnection (a refused handshake must fail, not retry). Rejects with the server's
 * `connect_error` message when the handshake is refused.
 */
export function connect(
  url: string,
  token: string | undefined,
): Promise<Listener> {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    const events: Array<[string, unknown]> = [];
    for (const name of OBSERVED)
      socket.on(name, (payload: unknown) => events.push([name, payload]));

    const listener: Listener = {
      socket,
      events,
      of: (event) =>
        events.filter(([name]) => name === event).map(([, payload]) => payload),
      waitFor: (event, count = 1, timeoutMs = 5_000) =>
        new Promise((done, fail) => {
          const started = Date.now();
          const tick = () => {
            const seen = listener.of(event);
            if (seen.length >= count) return done(seen);
            if (Date.now() - started > timeoutMs) {
              return fail(
                new Error(
                  `Timed out waiting for ${count} × ${event}; saw ${seen.length}`,
                ),
              );
            }
            setTimeout(tick, 15);
          };
          tick();
        }),
      refresh: (replacement) =>
        new Promise((done, fail) => {
          const timeout = setTimeout(
            () =>
              fail(
                new Error('Timed out waiting for auth.refresh acknowledgement'),
              ),
            5_000,
          );
          socket.emit('auth.refresh', { token: replacement }, (result) => {
            clearTimeout(timeout);
            done(result);
          });
        }),
      watch: (fileId) => action(socket, 'file.watch', fileId),
      unwatch: (fileId) => action(socket, 'file.unwatch', fileId),
      typing: (fileId, isTyping) => {
        socket.emit('comment.typing', { fileId, isTyping });
      },
      close: () => {
        socket.close();
      },
    };

    socket.once('connect', () => resolve(listener));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

function action(
  socket: ClientSocket,
  event: 'file.watch' | 'file.unwatch',
  fileId: string,
): Promise<SocketActionResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event} acknowledgement`)),
      5_000,
    );
    socket.emit(event, { fileId }, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
}

/** Gives events that SHOULD NOT arrive a fair chance to show up, before asserting they did not. */
export const settle = (ms = 300) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
