/** Every socket event name used by the app, in one place. */
export const SocketEvent = {
  // built-in
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
  // client -> server
  USER_JOIN: "user:join",
  ANSWER_SUBMIT: "answer:submit",
  // server -> client
  USERS_ONLINE: "users:online",
  ANSWER_RESULT: "answer:result",
  LEADERBOARD_UPDATE: "leaderboard:update",
  ERROR: "error",
} as const;

/** Points awarded for a correct answer. */
export const POINTS_PER_CORRECT_ANSWER = 10;

// ---- Payload contracts (client -> server) ----

export interface UserJoinPayload {
  userId: string;
}

export interface AnswerSubmitPayload {
  userId: string;
  quizId: number;
  questionId: number;
  /** The text of the option the user selected (order-independent). */
  answer: string;
}

// ---- Payload contracts (server -> client) ----

export interface OnlineUser {
  userId: string;
  username: string;
}

export interface UsersOnlinePayload {
  count: number;
  users: OnlineUser[];
}

export interface AnswerResultPayload {
  quizId: number;
  questionId: number;
  correct: boolean;
  /** The text of the correct option, so the client can highlight it. */
  correctAnswer: string;
  /** Points gained from this submission (0 if wrong or already answered). */
  awardedPoints: number;
  /** The submitter's total score after grading. */
  totalScore: number;
  /** True when this question had already been answered by this user. */
  alreadyAnswered: boolean;
}
