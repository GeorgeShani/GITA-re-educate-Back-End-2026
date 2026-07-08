import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

// ESM has no __dirname, so resolve the data file relative to this module.
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "expenses.json");

async function readAll() {
  const raw = await readFile(FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeAll(expenses) {
  await writeFile(FILE, JSON.stringify(expenses, null, 2));
}

// READ (all)
export async function getAllExpenses() {
  return readAll();
}

// READ (by id)
export async function getExpenseById(id) {
  const expenses = await readAll();
  return expenses.find((expense) => expense.id === Number(id));
}

// CREATE
export async function createExpense(data) {
  const expenses = await readAll();
  const lastId = expenses.length ? expenses[expenses.length - 1].id : 0;

  const newExpense = {
    id: lastId + 1,
    title: data.title,
    category: data.category,
    amount: Number(data.amount),
    date: data.date,
    paymentMethod: data.paymentMethod,
  };

  expenses.push(newExpense);
  await writeAll(expenses);
  return newExpense;
}

// UPDATE
export async function updateExpense(id, patch) {
  const expenses = await readAll();
  const index = expenses.findIndex((expense) => expense.id === Number(id));
  if (index === -1) return null;

  const updated = { ...expenses[index] };
  if (patch.title !== undefined) updated.title = patch.title;
  if (patch.category !== undefined) updated.category = patch.category;
  if (patch.amount !== undefined) updated.amount = Number(patch.amount);
  if (patch.date !== undefined) updated.date = patch.date;
  if (patch.paymentMethod !== undefined) updated.paymentMethod = patch.paymentMethod;

  expenses[index] = updated;
  await writeAll(expenses);
  return updated;
}

// DELETE
export async function deleteExpense(id) {
  const expenses = await readAll();
  const index = expenses.findIndex((expense) => expense.id === Number(id));
  if (index === -1) return false;

  expenses.splice(index, 1);
  await writeAll(expenses);
  return true;
}
