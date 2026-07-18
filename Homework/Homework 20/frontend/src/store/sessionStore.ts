import { create } from "zustand";
import { apiClient, apiErrorMessage, isConflict } from "../lib/api";
import { socket, SocketEvent } from "../lib/socket";
import type {
  AnswerResultPayload,
  LeaderboardEntry,
  OnlineUser,
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

  async join(rawUsername: string) {
    const username = rawUsername.trim();
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
    connectForUser(session);
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

function connectForUser(user: SessionUser): void {
  useSessionStore.setState({ status: "connecting" });
  
  socket.connect();
  socket.emit(SocketEvent.USER_JOIN, { userId: user.id });
}

socket.on("connect", () => useSessionStore.setState({ status: "connected" }));
socket.on("disconnect", () =>
  useSessionStore.setState({ status: "disconnected" }),
);

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

// Resume an existing session (e.g. after a page refresh) without requiring
// the user to go through the join screen again.
const initialUser = useSessionStore.getState().user;
if (initialUser) connectForUser(initialUser);
