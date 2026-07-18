import type { OnlineUser } from "./events";

/**
 * In-memory registry of who is currently connected. Keyed by socket id so a
 * user with several open tabs is tracked per connection, but reported as a
 * single distinct person in the online list.
 */
class OnlineUsersStore {
  private readonly bySocket = new Map<string, OnlineUser>();

  add(socketId: string, user: OnlineUser): void {
    this.bySocket.set(socketId, user);
  }

  remove(socketId: string): void {
    this.bySocket.delete(socketId);
  }

  /**
   * Every socket id currently registered for a given user. Used to evict an
   * existing session when the same account joins again elsewhere. A linear
   * scan is fine: the store only ever holds the live connections.
   */
  findSocketIdsByUserId(userId: string): string[] {
    const ids: string[] = [];
    for (const [socketId, user] of this.bySocket) {
      if (user.userId === userId) ids.push(socketId);
    }
    return ids;
  }

  /** Distinct online users (deduplicated by userId). */
  list(): OnlineUser[] {
    const distinct = new Map<string, OnlineUser>();
    for (const user of this.bySocket.values()) {
      distinct.set(user.userId, user);
    }
    return [...distinct.values()];
  }

  count(): number {
    return this.list().length;
  }
}

export const onlineUsers = new OnlineUsersStore();
