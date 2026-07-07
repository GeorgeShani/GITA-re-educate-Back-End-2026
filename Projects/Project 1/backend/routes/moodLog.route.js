import { Router } from "express";
import { createLog, listLogs } from "../controllers/moodLog.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
import { validate } from "../middlewares/validate.js";
import { createMoodLogSchema } from "../validations/moodLog.validation.js";

const router = Router();

router.use(isAuth);

router.post("/", validate(createMoodLogSchema), createLog);
router.get("/", listLogs);

export default router;
