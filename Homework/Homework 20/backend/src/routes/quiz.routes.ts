import { Router } from "express";
import { quizController } from "../controllers/quiz.controller";

const router = Router();

router.get("/", quizController.list);
router.get("/:id", quizController.getById);

export default router;
