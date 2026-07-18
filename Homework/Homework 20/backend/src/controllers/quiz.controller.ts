import type { Request, Response } from "express";
import { quizService } from "../services/quiz.service";

/** Shuffle is on by default; pass `?shuffle=false` to get a stable order. */
function wantsShuffle(req: Request): boolean {
  return req.query.shuffle !== "false";
}

/** Read-only REST controllers for the /api/quizzes resource. */
export const quizController = {
  list(req: Request, res: Response): void {
    res.json(quizService.getPublicQuizzes(wantsShuffle(req)));
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
