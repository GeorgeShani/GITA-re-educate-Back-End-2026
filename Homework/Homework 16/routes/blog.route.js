import { Router } from "express";
import {
  listBlogs,
  getBlog,
  createNewBlog,
  updateExistingBlog,
  removeBlog,
} from "../controllers/blog.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
import { validate } from "../middlewares/validate.js";
import { validateMongoId } from "../middlewares/validateMongoId.js";
import {
  createBlogSchema,
  updateBlogSchema,
} from "../validations/blog.validation.js";

const router = Router();

// Every blog route is protected by the isAuth middleware.
router.use(isAuth);

router.get("/", listBlogs);
router.get("/:id", validateMongoId, getBlog);
router.post("/", validate(createBlogSchema), createNewBlog);
router.put("/:id", validateMongoId, validate(updateBlogSchema), updateExistingBlog);
router.delete("/:id", validateMongoId, removeBlog);

export default router;
