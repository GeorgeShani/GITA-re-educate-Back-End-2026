import { Router } from "express";
import { quizController } from "../controllers/quiz.controller";

const router = Router();

// The list takes pagination + sort params, so it uses the HTTP QUERY method
// (safe + idempotent like GET, but carries a JSON request body) instead of a
// query string. A single quiz is still a plain GET by id.
// `query` is typed optional in @types/express, but is registered at runtime
// (Node 22 exposes QUERY in http.METHODS); the `!` reflects that.
router.query!("/", quizController.list);
router.get("/:id", quizController.getById);

export default router;
