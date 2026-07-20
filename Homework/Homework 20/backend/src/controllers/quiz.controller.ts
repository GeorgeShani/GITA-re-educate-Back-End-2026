import type { Request, Response } from "express";
import { quizService } from "../services/quiz.service";
import { userService } from "../services/user.service";
import type { QuizListOptions, QuizSortKey } from "../types/quiz";

/** Shuffle is on by default; pass `?shuffle=false` to get a stable order. */
function wantsShuffle(req: Request): boolean {
  return req.query.shuffle !== "false";
}

const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 36;
const SORT_KEYS: readonly QuizSortKey[] = ["default", "title", "progress"];

/** Coerce an unknown to a positive integer, falling back to `fallback`. */
function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Read the pagination + sort options from the QUERY request body. Every field
 * is optional and defensively defaulted, so a QUERY with no body (or garbage
 * values) still yields a valid first page in default order.
 *
 * `sort: "progress"` additionally needs the requester's answered-question
 * set, resolved here (not trusted from the body) via `userId` so a client
 * can't spoof its own completion state — it's only a display/sort concern,
 * not scoring, but there's no reason to trust client-supplied progress when
 * the real record is one lookup away. Unknown or missing `userId` degrades
 * to "nothing answered" rather than erroring.
 */
async function parseListOptions(req: Request): Promise<QuizListOptions> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sort = SORT_KEYS.includes(body.sort as QuizSortKey)
    ? (body.sort as QuizSortKey)
    : "default";

  let answeredQuestions: string[] = [];
  if (sort === "progress" && typeof body.userId === "string") {
    const user = await userService.getUserById(body.userId);
    if (user) answeredQuestions = user.answeredQuestions;
  }

  return {
    page: toPositiveInt(body.page, 1),
    limit: Math.min(toPositiveInt(body.limit, DEFAULT_LIMIT), MAX_LIMIT),
    sort,
    order: body.order === "desc" ? "desc" : "asc",
    withShuffle: body.shuffle !== false,
    answeredQuestions,
  };
}

/** Read-only REST controllers for the /api/quizzes resource. */
export const quizController = {
  async list(req: Request, res: Response): Promise<void> {
    res.json(quizService.getPublicQuizzes(await parseListOptions(req)));
  },

  getById(req: Request, res: Response): void {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Quiz id must be a number" });
      return;
    }
    
    const quiz = quizService.getPublicQuizById(id, wantsShuffle(req));
    if (!quiz) {
      res.status(404).json({ message: "Quiz not found" });
      return;
    }
    
    res.json(quiz);
  },
};
