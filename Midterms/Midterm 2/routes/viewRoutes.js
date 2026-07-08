import { Router } from "express";
import { getAllExpenses, getExpenseById } from "../data/expensesModel.js";
import { categories, colorFor } from "../data/categories.js";

const router = Router();

// Build the donut-chart data from a list of expenses: one slice per category.
function buildChartData(expenses) {
  const totalsByCategory = {};
  for (const expense of expenses) {
    totalsByCategory[expense.category] =
      (totalsByCategory[expense.category] || 0) + expense.amount;
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const slices = Object.entries(totalsByCategory)
    .map(([category, amount]) => ({ category, amount, color: colorFor(category) }))
    .sort((a, b) => b.amount - a.amount);

  return { slices, total };
}

// HOME — list of expenses with optional category filter + donut chart
router.get("/", async (req, res) => {
  try {
    const activeSearch = (req.query.search || "").trim();
    const activeCategory = (req.query.category || "").trim();

    let expenses = await getAllExpenses();

    if (activeCategory) {
      expenses = expenses.filter((expense) => expense.category === activeCategory);
    }
    if (activeSearch) {
      const needle = activeSearch.toLowerCase();
      expenses = expenses.filter((expense) =>
        expense.title.toLowerCase().includes(needle)
      );
    }

    // Newest first (by date, tie-break on id for same-day entries).
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    res.render("pages/home", {
      expenses,
      categories,
      activeSearch,
      activeCategory,
      chart: buildChartData(expenses),
      colorFor,
    });
  } catch (error) {
    res.status(500).send("Failed to load expenses");
  }
});

// CREATE (form)
router.get("/create", (req, res) => {
  res.render("pages/create-expense", { categories });
});

// READ BY ID (details page)
router.get("/expenses/:id", async (req, res) => {
  try {
    const expense = await getExpenseById(req.params.id);
    if (!expense) return res.status(404).send("Expense not found");
    res.render("pages/expense-details", { expense, colorFor });
  } catch (error) {
    res.status(500).send("Failed to load expense");
  }
});

// EDIT (form)
router.get("/expenses/:id/edit", async (req, res) => {
  try {
    const expense = await getExpenseById(req.params.id);
    if (!expense) return res.status(404).send("Expense not found");
    res.render("pages/edit-expense", { expense, categories });
  } catch (error) {
    res.status(500).send("Failed to load expense");
  }
});

export default router;
