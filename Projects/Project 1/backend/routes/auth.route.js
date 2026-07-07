import { Router } from "express";
import { register, login, current } from "../controllers/auth.controller.js";
import { signUpSchema, signInSchema } from "../validations/auth.validation.js";
import { validate } from "../middlewares/validate.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = Router();

router.post("/sign-up", validate(signUpSchema), register);
router.post("/sign-in", validate(signInSchema), login);
router.get("/current", isAuth, current);

export default router;
