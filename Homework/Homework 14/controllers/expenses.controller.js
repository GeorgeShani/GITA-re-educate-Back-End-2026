import {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../services/expenses.service.js";

export async function listExpenses(req, res) {
  try {
    const page = Number(req.query.page) || 1;
    const take = Number(req.query.take) || 10;
    const result = await getAllExpenses(page, take);
    return res.status(200).json(result);
  } catch (error) {
    if (
      error.message.includes("page") ||
      error.message.includes("take")
    ) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getExpense(req, res) {
  try {
    const expense = await getExpenseById(req.params.id);
    return res.status(200).json(expense);
  } catch (error) {
    if (error.message === "Expense not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function createNewExpense(req, res) {
  try {
    const { category, price } = req.body;
    const newExpense = await createExpense(category, price);
    return res.status(201).json(newExpense);
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("must be")
    ) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateExistingExpense(req, res) {
  try {
    const { category, price } = req.body;
    const updated = await updateExpense(req.params.id, category, price);
    return res.status(200).json(updated);
  } catch (error) {
    if (error.message === "Expense not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes("must be")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function removeExpense(req, res) {
  try {
    const result = await deleteExpense(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "Expense not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
