import { Router } from "express";
import userRoutes from "./user.routes";
import quizRoutes from "./quiz.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/users", userRoutes);
router.use("/quizzes", quizRoutes);

export default router;
