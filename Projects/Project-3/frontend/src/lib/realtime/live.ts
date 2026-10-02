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

export interface LiveHandlers {
  onFileStatus?: (event: FileStatusEvent) => void;
  onQuota?: (event: QuotaEvent) => void;
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

/**
 * ONE connection per browser tab, shared by everything on the page that listens. It opens when the first listener
 * subscribes and closes when the last one leaves. The access token is fetched from this site (the browser cannot read its
 * httpOnly cookie), and a lost connection is reopened with a fresh one after a growing pause.
 */
const listeners = new Set<LiveHandlers>();
let socket: Socket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

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
