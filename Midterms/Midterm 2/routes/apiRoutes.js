import { Router } from "express";
import {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../data/expensesModel.js";

const router = Router();

// READ (all) — supports ?category= filter
router.get("/expenses", async (req, res) => {
  try {
    const search = (req.query.search || "").trim().toLowerCase();
    const category = (req.query.category || "").trim();
    let expenses = await getAllExpenses();
    if (category) {
      expenses = expenses.filter((expense) => expense.category === category);
    }
    if (search) {
      expenses = expenses.filter((expense) =>
        expense.title.toLowerCase().includes(search)
      );
    }
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: "Failed to read expenses" });
  }
});

// READ (by id)
router.get("/expenses/:id", async (req, res) => {
  try {
    const expense = await getExpenseById(req.params.id);
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to read expense" });
  }
});

// CREATE
router.post("/expenses", async (req, res) => {
  try {
    await createExpense(req.body);
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Failed to create expense");
  }
});

// UPDATE
router.post("/expenses/:id/update", async (req, res) => {
  try {
    const updated = await updateExpense(req.params.id, req.body);
    if (!updated) return res.status(404).send("Expense not found");
    res.redirect(`/expenses/${req.params.id}`);
  } catch (error) {
    res.status(500).send("Failed to update expense");
  }
});

// DELETE (GET form submit — HTML forms can't emit DELETE)
router.get("/expenses/:id/delete", async (req, res) => {
  try {
    await deleteExpense(req.params.id);
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Failed to delete expense");
  }
});

export default router;
