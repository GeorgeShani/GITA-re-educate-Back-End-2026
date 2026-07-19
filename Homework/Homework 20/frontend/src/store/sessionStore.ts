import { create } from "zustand";
import { apiClient, apiErrorMessage, isConflict } from "../lib/api";
import { socket, SocketEvent } from "../lib/socket";
import type {
  AnswerResultPayload,
  LeaderboardEntry,
  OnlineUser,
  SessionKickedPayload,
  SessionUser,
} from "../types";

const STORAGE_KEY = "cs-quiz-session";
const ANSWER_TIMEOUT_MS = 10_000;

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

export interface SocketErrorEvent {
  id: number;
  message: string;
}

interface SessionState {
  user: SessionUser | null;
  status: ConnectionStatus;
  leaderboard: LeaderboardEntry[];
  onlineCount: number;
  onlineUsers: OnlineUser[];
  lastError: SocketErrorEvent | null;
  kickedMessage: SocketErrorEvent | null;
  join: (username: string) => Promise<void>;
  submitAnswer: (
    quizId: number,
    questionId: number,
    answer: string,
  ) => Promise<AnswerResultPayload>;
  updateUsername: (username: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => void;
}

function loadStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SessionUser;
    if (typeof parsed.id === "string" && typeof parsed.username === "string") {
      return parsed;
    }
  } catch {
    // ignore malformed storage
  }

  return null;
}

// Answer submissions are matched to their `answer:result` by quiz+question key.
// Kept outside the store since pending promise resolvers aren't serializable state.
const pendingAnswers = new Map<
  string,
  {
    resolve: (v: AnswerResultPayload) => void;
    reject: (e: Error) => void;
  }
>();

export const useSessionStore = create<SessionState>((set, get) => ({
  user: loadStoredUser(),
  status: "idle",
  leaderboard: [],
  onlineCount: 0,
  onlineUsers: [],
  lastError: null,
  kickedMessage: null,

  async join(rawUsername: string) {
    const username = rawUsername.trim();
    set({ kickedMessage: null });
    let session: SessionUser;

    try {
      const created = await apiClient.createUser(username);
      session = { id: created._id, username: created.username };
    } catch (error) {
      if (!isConflict(error)) {
        throw new Error(apiErrorMessage(error));
      }

      // Username already exists: resume that account instead of failing.
      const users = await apiClient.getUsers();
      const existing = users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase(),
      );
      
      if (!existing) {
        throw new Error("That username is taken and could not be resumed.");
      }
      
      session = { id: existing._id, username: existing.username };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ user: session });
    connectSocket();
  },

  submitAnswer(quizId, questionId, answer) {
    const user = get().user;
    if (!user) return Promise.reject(new Error("Not joined yet."));

    const key = `${quizId}:${questionId}`;
    return new Promise<AnswerResultPayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingAnswers.delete(key);
        reject(
          new Error("Timed out waiting for the server to grade that answer."),
        );
      }, ANSWER_TIMEOUT_MS);

      pendingAnswers.set(key, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      socket.emit(SocketEvent.ANSWER_SUBMIT, {
        userId: user.id,
        quizId,
        questionId,
        answer,
      });
    });
  },

  async updateUsername(rawUsername: string) {
    const user = get().user;
    if (!user) throw new Error("Not joined yet.");

    try {
      const updated = await apiClient.updateUser(user.id, {
        username: rawUsername.trim(),
      });
      
      const session: SessionUser = {
        id: updated._id,
        username: updated.username,
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      set({ user: session });
    } catch (error) {
      throw new Error(apiErrorMessage(error));
    }
  },

  async deleteAccount() {
    const user = get().user;
    if (!user) return;

    try {
      await apiClient.deleteUser(user.id);
    } catch (error) {
      throw new Error(apiErrorMessage(error));
    }

    get().logout();
  },

  logout() {
    for (const pending of pendingAnswers.values()) {
      pending.reject(new Error("Logged out."));
    }

    pendingAnswers.clear();

    localStorage.removeItem(STORAGE_KEY);
    socket.disconnect();

    set({
      user: null,
      status: "idle",
      leaderboard: [],
      onlineCount: 0,
      onlineUsers: [],
      lastError: null,
    });
  },
}));

function connectSocket(): void {
  useSessionStore.setState({ status: "connecting" });
  socket.connect();
}

// Re-announce on every connect, not just the first: socket.io reconnects
// automatically after a dropped connection (idle proxies commonly close a
// quiet WebSocket after a while), which gets a fresh socket.id but would
// otherwise never re-run user:join — leaving the server's online/leaderboard
// state unaware this client is back.
socket.on("connect", () => {
  useSessionStore.setState({ status: "connected" });

  const user = useSessionStore.getState().user;
  if (user) socket.emit(SocketEvent.USER_JOIN, { userId: user.id });
});
socket.on("disconnect", (reason) => {
  useSessionStore.setState({ status: "disconnected" });

  // socket.io auto-reconnects on transport-level drops (ping timeout /
  // transport close), and the "connect" handler above re-announces on each.
  // But when the SERVER initiates the close ("io server disconnect" - e.g. the
  // host recycles a quiet connection), socket.io deliberately does NOT
  // reconnect. Left alone that strands the client: still "logged in" but
  // silently offline, with a frozen leaderboard/online list until a full page
  // reload. Reconnect ourselves - unless we tore down on purpose (logout and
  // kick both null out the user first, so this guard skips them).
  if (reason === "io server disconnect" && useSessionStore.getState().user) {
    connectSocket();
  }
});

socket.on(
  SocketEvent.USERS_ONLINE,
  (payload: { count: number; users: OnlineUser[] }) => {
    useSessionStore.setState({
      onlineCount: payload.count,
      onlineUsers: payload.users,
    });
  },
);

socket.on(SocketEvent.LEADERBOARD_UPDATE, (payload: LeaderboardEntry[]) => {
  useSessionStore.setState({ leaderboard: payload });
});

socket.on(SocketEvent.ANSWER_RESULT, (payload: AnswerResultPayload) => {
  const key = `${payload.quizId}:${payload.questionId}`;
  const pending = pendingAnswers.get(key);
  if (pending) {
    pending.resolve(payload);
    pendingAnswers.delete(key);
  }
});

socket.on(SocketEvent.ERROR, (payload: { message: string }) => {
  useSessionStore.setState({
    lastError: { id: Date.now(), message: payload.message },
  });
});

// The account was opened elsewhere: tear down this session, then surface a
// message. logout() runs first (it resets lastError among other fields but
// never touches kickedMessage), so the follow-up setState survives.
socket.on(SocketEvent.SESSION_KICKED, (payload: SessionKickedPayload) => {
  useSessionStore.getState().logout();
  useSessionStore.setState({
    kickedMessage: { id: Date.now(), message: payload.message },
  });
});

// A backgrounded tab or a sleeping device freezes socket.io's heartbeat
// timers, so the server can time the connection out and drop us while the
// client never notices (it still believes it's connected). When the tab
// returns to the foreground, re-sync: reconnect if the socket actually died,
// otherwise re-announce so the server re-registers us and pushes fresh
// presence + leaderboard. Re-emitting user:join is idempotent server-side.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const user = useSessionStore.getState().user;
    if (!user) return;

    if (socket.connected) {
      socket.emit(SocketEvent.USER_JOIN, { userId: user.id });
    } else {
      connectSocket();
    }
  });
}

// Resume an existing session (e.g. after a page refresh) without requiring
// the user to go through the join screen again.
if (useSessionStore.getState().user) connectSocket();
