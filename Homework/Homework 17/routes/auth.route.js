import { Router } from "express";
import { register, login, current } from "../controllers/auth.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  registerSchema,
  loginSchema,
} from "../validations/auth.validation.js";

const router = Router();

router.post("/sign-up", validate(registerSchema), register);
router.post("/sign-in", validate(loginSchema), login);
router.get("/current", isAuth, current);

export default router;
