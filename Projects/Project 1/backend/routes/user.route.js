import { Router } from "express";
import { updateMyProfile } from "../controllers/user.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
import { validate } from "../middlewares/validate.js";
import { uploadSingle } from "../middlewares/upload.js";
import { updateProfileSchema } from "../validations/user.validation.js";

const router = Router();

router.use(isAuth);

// multipart/form-data: `name` (text) + optional `avatar` (file). uploadSingle
// must run before validate() — multer is what parses the multipart body and
// populates req.body.name in the first place, so validating req.body any
// earlier would just see an empty object.
router.patch("/me", uploadSingle("avatar"), validate(updateProfileSchema), updateMyProfile);

export default router;
