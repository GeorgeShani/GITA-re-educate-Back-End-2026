import { Router } from "express";
import {
  listUsers,
  getUser,
  removeUser,
} from "../controllers/user.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
import { validateMongoId } from "../middlewares/validateMongoId.js";

const router = Router();

router.get("/", listUsers);
router.get("/:id", validateMongoId, getUser);
router.delete("/:id", isAuth, validateMongoId, removeUser);

export default router;
