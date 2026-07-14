import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { requireAdmin } from "../middlewares/admin.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  updateProductSchema,
} from "../validations/product.validation";

const router = Router();

router.get("/", productController.getAllProducts);
router.get("/summary", productController.getProductSummaries);
router.get("/:id", productController.getProductById);
router.post("/", validate(createProductSchema), productController.createProduct);
router.put("/:id", requireAdmin, validate(updateProductSchema), productController.updateProduct);
router.delete("/:id", requireAdmin, productController.deleteProduct);

export default router;
