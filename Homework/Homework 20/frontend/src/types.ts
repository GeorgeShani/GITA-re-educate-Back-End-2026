// Mirrors backend/src/types/quiz.ts and backend/src/socket/events.ts.

export interface PublicQuestion {
  id: number;
  prompt: string;
  options: string[];
}

export interface PublicQuiz {
  id: number;
  /** Internal categorization, not rendered directly in the UI. */
  topic: string;
  title: string;
  description: string;
  /** Short, themed source-file name shown on the card badge, e.g. "nlp.py". */
  filename: string;
  questions: PublicQuestion[];
}

/**
 * Fields the quiz list can be ordered by. `default` keeps source (id) order.
 * `progress` ranks by how much of the quiz the current user has answered.
 */
export type QuizSortKey = "default" | "title" | "progress";
export type SortOrder = "asc" | "desc";

/** A page of results plus the metadata needed to render pagination. */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

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
  correctAnswer: string;
  awardedPoints: number;
  totalScore: number;
  alreadyAnswered: boolean;
}

export interface SessionKickedPayload {
  message: string;
}

export interface ApiUser {
  _id: string;
  username: string;
  score: number;
  answeredQuestions: string[];
  createdAt: string;
  updatedAt: string;
}

/** The locally persisted session identity. */
export interface SessionUser {
  id: string;
  username: string;
}
