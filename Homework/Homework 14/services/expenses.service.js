import fs from "fs/promises";

const DB_FILE = "./expenses.json";
const MAX_TAKE = 50;

async function readExpenses() {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeExpenses(expenses) {
  await fs.writeFile(DB_FILE, JSON.stringify(expenses, null, 2));
}

export async function getAllExpenses(page = 1, take = 10) {
  const expenses = await readExpenses();

  if (page < 1 || take < 1) {
    throw new Error("page and take must be positive numbers");
  }

  if (take > MAX_TAKE) {
    throw new Error(`take cannot exceed ${MAX_TAKE}`);
  }

  const start = (page - 1) * take;
  const end = start + take;

  return {
    page,
    take,
    total: expenses.length,
    totalPages: Math.ceil(expenses.length / take),
    data: expenses.slice(start, end),
  };
}

export async function getExpenseById(id) {
  const expenses = await readExpenses();
  const expense = expenses.find((e) => e.id === Number(id));
  if (!expense) throw new Error("Expense not found");
  return expense;
}

export async function createExpense(category, price) {
  if (!category || price === undefined) {
    throw new Error("category and price are required");
  }

  if (typeof price !== "number" || price < 10) {
    throw new Error("price must be a number and at least 10");
  }

  const expenses = await readExpenses();

  const newExpense = {
    id:
      expenses.length > 0
        ? Math.max(...expenses.map((exp) => exp.id)) + 1
        : 1,
    category,
    price,
    createdAt: new Date().toISOString(),
  };

  expenses.push(newExpense);
  await writeExpenses(expenses);

  return newExpense;
}

export async function updateExpense(id, category, price) {
  const expenses = await readExpenses();
  const index = expenses.findIndex((e) => e.id === Number(id));

  if (index === -1) throw new Error("Expense not found");

  if (price !== undefined) {
    if (typeof price !== "number" || price < 10) {
      throw new Error("price must be a number and at least 10");
    }
    expenses[index].price = price;
  }

  if (category) {
    expenses[index].category = category;
  }

  await writeExpenses(expenses);
  return expenses[index];
}

export async function deleteExpense(id) {
  const expenses = await readExpenses();
  const filteredExpenses = expenses.filter((e) => e.id !== Number(id));

  if (filteredExpenses.length === expenses.length) {
    throw new Error("Expense not found");
  }

  await writeExpenses(filteredExpenses);
  return { message: "Expense deleted successfully" };
}
