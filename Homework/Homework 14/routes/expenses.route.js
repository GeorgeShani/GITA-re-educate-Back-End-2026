import { Router } from "express";
import {
  listExpenses,
  getExpense,
  createNewExpense,
  updateExistingExpense,
  removeExpense,
} from "../controllers/expenses.controller.js";
import { validateSecretKey } from "../middlewares/validateSecretKey.js";
import { validateExpenseFields } from "../middlewares/validateExpenseFields.js";

const router = Router();

router.get("/", listExpenses);
router.get("/:id", getExpense);
router.post("/", validateExpenseFields, createNewExpense);
router.put("/:id", updateExistingExpense);
router.delete("/:id", validateSecretKey, removeExpense);

export default router;
