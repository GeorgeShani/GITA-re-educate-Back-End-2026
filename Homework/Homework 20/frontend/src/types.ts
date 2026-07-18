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
  questions: PublicQuestion[];
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
