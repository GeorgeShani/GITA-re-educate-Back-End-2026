import { Router } from "express";
import {
  listUsers,
  getUser,
  removeUser,
  uploadPhoto,
  deletePhoto,
} from "../controllers/user.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
import { validateMongoId } from "../middlewares/validateMongoId.js";
import { uploadSingle } from "../middlewares/upload.js";

const router = Router();

router.get("/", listUsers);

// Profile photo management for the authenticated user. Declared before the
// "/:id" routes so they are not swallowed by the id param matcher.
router.put("/profile-photo", isAuth, uploadSingle("profilePhoto"), uploadPhoto);
router.delete("/profile-photo", isAuth, deletePhoto);

router.get("/:id", validateMongoId, getUser);
router.delete("/:id", isAuth, validateMongoId, removeUser);

export default router;
