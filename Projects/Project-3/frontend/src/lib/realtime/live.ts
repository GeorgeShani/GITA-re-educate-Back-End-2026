import { io, type Socket } from "socket.io-client";
import { isRecord } from "@/lib/guards";

/** A report moved to a new status (`file.status`). */
export interface FileStatusEvent {
  fileId: string;
  status: string;
  qualityScore: number | null;
}

/** An upload was counted against the plan's quota (`quota.updated`). */
export interface QuotaEvent {
  filesUsed: number;
  filesLimit: number;
}

/** A new inbox entry for this person (`notification.created`). */
export interface NotificationEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Who is looking at a file right now (`presence.changed`), by user id. */
export interface PresenceEvent {
  fileId: string;
  userIds: string[];
}

/** A comment on a file was added, edited or removed (`comment.created` / `updated` / `deleted`). */
export interface CommentEvent {
  kind: "created" | "updated" | "deleted";
  fileId: string;
  commentId: string;
  authorId: string | null;
}

/** Somebody started or stopped typing a comment (`comment.typing`). */
export interface TypingEvent {
  fileId: string;
  userId: string;
  isTyping: boolean;
}

export interface LiveHandlers {
  onFileStatus?: (event: FileStatusEvent) => void;
  onQuota?: (event: QuotaEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
  onPresence?: (event: PresenceEvent) => void;
  onComment?: (event: CommentEvent) => void;
  onTyping?: (event: TypingEvent) => void;
}

function toFileStatus(value: unknown): FileStatusEvent | null {
  if (!isRecord(value)) return null;
  const { fileId, status, qualityScore } = value;
  if (typeof fileId !== "string" || typeof status !== "string") return null;
  return {
    fileId,
    status,
    qualityScore: typeof qualityScore === "number" ? qualityScore : null,
  };
}

function toQuota(value: unknown): QuotaEvent | null {
  if (!isRecord(value)) return null;
  const { filesUsed, filesLimit } = value;
  if (typeof filesUsed !== "number" || typeof filesLimit !== "number") {
    return null;
  }
  return { filesUsed, filesLimit };
}

function toPresence(value: unknown): PresenceEvent | null {
  if (!isRecord(value)) return null;
  const { fileId, userIds } = value;
  if (typeof fileId !== "string" || !Array.isArray(userIds)) return null;
  return {
    fileId,
    userIds: userIds.filter((id): id is string => typeof id === "string"),
  };
}

function toComment(
  kind: CommentEvent["kind"],
  value: unknown,
): CommentEvent | null {
  if (!isRecord(value)) return null;
  const { id, fileId, author } = value;
  if (typeof id !== "string" || typeof fileId !== "string") return null;
  const authorId =
    isRecord(author) && typeof author.id === "string" ? author.id : null;
  return { kind, fileId, commentId: id, authorId };
}

function toTyping(value: unknown): TypingEvent | null {
  if (!isRecord(value)) return null;
  const { fileId, userId, isTyping } = value;
  if (
    typeof fileId !== "string" ||
    typeof userId !== "string" ||
    typeof isTyping !== "boolean"
  ) {
    return null;
  }
  return { fileId, userId, isTyping };
}

function toNotification(value: unknown): NotificationEvent | null {
  if (!isRecord(value)) return null;
  const { id, type, payload, createdAt } = value;
  if (
    typeof id !== "string" ||
    typeof type !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return { id, type, payload: isRecord(payload) ? payload : {}, createdAt };
}

/**
 * ONE connection per browser tab, shared by everything on the page that listens. It opens when the first listener
 * subscribes and closes when the last one leaves. The access token is fetched from this site (the browser cannot read its
 * httpOnly cookie), and a lost connection is reopened with a fresh one after a growing pause.
 */
const listeners = new Set<LiveHandlers>();
let socket: Socket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
/** Files this tab is looking at: joined again after every reconnect, because the server forgets them with the socket. */
const watched = new Map<string, number>();

async function freshToken(): Promise<string | null> {
  try {
    const response = await fetch("/session/socket-token", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.token === "string" ? body.token : null;
  } catch {
    return null;
  }
}

function realtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL || window.location.origin;
}

async function open(): Promise<void> {
  if (socket || listeners.size === 0) return;
  const token = await freshToken();
  if (!token || listeners.size === 0 || socket) {
    if (!token) scheduleRetry();
    return;
  }

  const next = io(realtimeUrl(), {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  socket = next;

  next.on("connect", () => {
    failures = 0;
    for (const fileId of watched.keys()) next.emit("file.watch", { fileId });
  });
  next.on("presence.changed", (payload: unknown) => {
    const event = toPresence(payload);
    if (!event) return;
    for (const handler of listeners) handler.onPresence?.(event);
  });
  for (const kind of ["created", "updated", "deleted"] as const) {
    next.on(`comment.${kind}`, (payload: unknown) => {
      const event = toComment(kind, payload);
      if (!event) return;
      for (const handler of listeners) handler.onComment?.(event);
    });
  }
  next.on("comment.typing", (payload: unknown) => {
    const event = toTyping(payload);
    if (!event) return;
    for (const handler of listeners) handler.onTyping?.(event);
  });
  next.on("file.status", (payload: unknown) => {
    const event = toFileStatus(payload);
    if (!event) return;
    for (const handler of listeners) handler.onFileStatus?.(event);
  });
  next.on("quota.updated", (payload: unknown) => {
    const event = toQuota(payload);
    if (!event) return;
    for (const handler of listeners) handler.onQuota?.(event);
  });
  next.on("notification.created", (payload: unknown) => {
    const event = toNotification(payload);
    if (!event) return;
    for (const handler of listeners) handler.onNotification?.(event);
  });
  // The token is short-lived: hand the server a new one before it ends, so the connection need not drop.
  next.on("session.expiring", async () => {
    const replacement = await freshToken();
    if (replacement) next.emit("auth.refresh", { token: replacement });
  });
  const lost = () => {
    if (socket !== next) return;
    socket = null;
    next.removeAllListeners();
    scheduleRetry();
  };
  next.on("disconnect", lost);
  next.on("connect_error", lost);
}

function scheduleRetry(): void {
  if (retry || listeners.size === 0) return;
  failures += 1;
  const pause = Math.min(30_000, 2_000 * 2 ** Math.min(failures, 4));
  retry = setTimeout(() => {
    retry = null;
    void open();
  }, pause);
}

/** Listen for live updates. Returns the function that stops listening. */
export function subscribeLive(handlers: LiveHandlers): () => void {
  listeners.add(handlers);
  void open();
  return () => {
    listeners.delete(handlers);
    if (listeners.size > 0) return;
    if (retry) clearTimeout(retry);
    retry = null;
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  };
}

/**
 * Says "I am looking at this file", so colleagues see it and this tab hears their typing and comments. Returns the function
 * that says "I have left". Several parts of one page may ask for the same file; it is joined once and left with the last.
 */
export function watchFile(fileId: string): () => void {
  watched.set(fileId, (watched.get(fileId) ?? 0) + 1);
  if (watched.get(fileId) === 1 && socket?.connected) {
    socket.emit("file.watch", { fileId });
  }
  return () => {
    const left = (watched.get(fileId) ?? 1) - 1;
    if (left > 0) {
      watched.set(fileId, left);
      return;
    }
    watched.delete(fileId);
    if (socket?.connected) socket.emit("file.unwatch", { fileId });
  };
}

/** Tells the people looking at this file that this person started or stopped typing a comment. */
export function sendTyping(fileId: string, isTyping: boolean): void {
  if (socket?.connected) socket.emit("comment.typing", { fileId, isTyping });
}
