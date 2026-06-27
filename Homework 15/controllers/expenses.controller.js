import {
  getAllExpenses,
  getTopFiveExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../services/expenses.service.js";

export async function listExpenses(req, res) {
  try {
    const result = await getAllExpenses({
      page: req.query.page,
      take: req.query.take,
      category: req.query.category,
      amountFrom: req.query.amountFrom,
      amountTo: req.query.amountTo,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (
      error.message.includes("page") ||
      error.message.includes("take") ||
      error.message.includes("amount")
    ) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function listTopFiveExpenses(req, res) {
  try {
    const expenses = await getTopFiveExpenses();
    return res.status(200).json(expenses);
  } catch (error) {
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
    const { category, price, amount } = req.body;
    const finalPrice = price ?? amount;
    const newExpense = await createExpense(category, finalPrice);
    return res.status(201).json(newExpense);
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("must be") ||
      error.message.includes("at least")
    ) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateExistingExpense(req, res) {
  try {
    const { category, price, amount } = req.body;
    const finalPrice = price ?? amount;
    const updated = await updateExpense(req.params.id, category, finalPrice);
    return res.status(200).json(updated);
  } catch (error) {
    if (error.message === "Expense not found") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error.message.includes("must be") ||
      error.message.includes("At least") ||
      error.message.includes("at least")
    ) {
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
