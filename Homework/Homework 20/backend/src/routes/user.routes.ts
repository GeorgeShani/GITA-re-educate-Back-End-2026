import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.post("/", asyncHandler(userController.create));
router.get("/", asyncHandler(userController.list));
router.get("/:id", asyncHandler(userController.getById));
router.patch("/:id", asyncHandler(userController.update));
router.delete("/:id", asyncHandler(userController.remove));

export default router;
