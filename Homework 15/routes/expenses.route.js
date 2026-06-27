import { Router } from "express";
import {
  listExpenses,
  listTopFiveExpenses,
  getExpense,
  createNewExpense,
  updateExistingExpense,
  removeExpense,
} from "../controllers/expenses.controller.js";
import { validateSecretKey } from "../middlewares/validateSecretKey.js";
import { validateExpenseFields } from "../middlewares/validateExpenseFields.js";
import { validateMongoId } from "../middlewares/validateMongoId.js";

const router = Router();

router.get("/", listExpenses);
router.get("/top-5", listTopFiveExpenses);
router.get("/:id", validateMongoId, getExpense);
router.post("/", validateExpenseFields, createNewExpense);
router.put("/:id", validateMongoId, updateExistingExpense);
router.delete("/:id", validateMongoId, validateSecretKey, removeExpense);

export default router;
