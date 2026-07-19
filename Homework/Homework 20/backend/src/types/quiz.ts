/**
 * A single question inside a quiz. `answer` (the correct option's text) is never
 * sent to clients; the socket layer uses it to grade submitted answers.
 */
export interface QuizQuestion {
  id: number;
  prompt: string;
  options: string[];
  answer: string;
}

/**
 * A quiz: a themed series of questions (10 per quiz in this app).
 */
export interface Quiz {
  id: number;
  topic: string;
  title: string;
  description: string;
  /** Short, themed source-file name shown on the card badge, e.g. "nlp.py". */
  filename: string;
  questions: QuizQuestion[];
}

/** Question shape safe to expose over the public REST API (no answer). */
export type PublicQuestion = Omit<QuizQuestion, "answer">;

/** Quiz shape safe to expose over the public REST API. */
export interface PublicQuiz extends Omit<Quiz, "questions"> {
  questions: PublicQuestion[];
}

/** A single row of the real-time leaderboard broadcast to every client. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

/** Fields the quiz list can be ordered by. `default` keeps source (id) order. */
export type QuizSortKey = "default" | "title" | "topic";
export type SortOrder = "asc" | "desc";

/** A page of results plus the metadata a client needs to render pagination. */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Parsed, validated options for a quiz-list query. */
export interface QuizListOptions {
  page: number;
  limit: number;
  sort: QuizSortKey;
  order: SortOrder;
  withShuffle: boolean;
}
