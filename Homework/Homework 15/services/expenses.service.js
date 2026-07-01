import Expense from "../models/expense.model.js";

const MAX_TAKE = 50;

function parsePositiveInteger(value, fieldName, defaultValue) {
  const normalized = value === undefined ? defaultValue : Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return normalized;
}

function parsePrice(value, fieldName) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return normalized;
}

function buildFilters({ category, amountFrom, amountTo }) {
  const filters = {};

  if (category) {
    const categories = category
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (categories.length > 0) {
      filters.category = { $in: categories };
    }
  }

  if (amountFrom !== undefined || amountTo !== undefined) {
    const priceFilter = {};

    if (amountFrom !== undefined) {
      priceFilter.$gte = parsePrice(amountFrom, "amountFrom");
    }

    if (amountTo !== undefined) {
      priceFilter.$lte = parsePrice(amountTo, "amountTo");
    }

    if (
      priceFilter.$gte !== undefined &&
      priceFilter.$lte !== undefined &&
      priceFilter.$gte > priceFilter.$lte
    ) {
      throw new Error("amountFrom cannot be greater than amountTo");
    }

    filters.price = priceFilter;
  }

  return filters;
}

export async function getAllExpenses({
  page = 1,
  take = 10,
  category,
  amountFrom,
  amountTo,
}) {
  const normalizedPage = parsePositiveInteger(page, "page", 1);
  const normalizedTake = parsePositiveInteger(take, "take", 10);

  if (normalizedTake > MAX_TAKE) {
    throw new Error(`take cannot exceed ${MAX_TAKE}`);
  }

  const filters = buildFilters({ category, amountFrom, amountTo });

  const [total, data] = await Promise.all([
    Expense.countDocuments(filters),
    Expense.find(filters)
      .sort({ createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedTake)
      .limit(normalizedTake),
  ]);

  return {
    page: normalizedPage,
    take: normalizedTake,
    total,
    totalPages: Math.ceil(total / normalizedTake),
    data,
  };
}

export async function getTopFiveExpenses() {
  return Expense.find({}).sort({ price: -1, createdAt: -1 }).limit(5);
}

export async function getExpenseById(id) {
  const expense = await Expense.findById(id);
  if (!expense) throw new Error("Expense not found");
  return expense;
}

export async function createExpense(category, price) {
  if (category === undefined || price === undefined) {
    throw new Error("category and price are required");
  }

  if (typeof category !== "string" || !category.trim()) {
    throw new Error("category must be a non-empty string");
  }

  const normalizedPrice = parsePrice(price, "price");
  if (normalizedPrice < 10) {
    throw new Error("price must be at least 10");
  }

  const newExpense = await Expense.create({
    category: category.trim(),
    price: normalizedPrice,
  });

  return newExpense;
}

export async function updateExpense(id, category, price) {
  const updatePayload = {};

  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim()) {
      throw new Error("category must be a non-empty string");
    }
    updatePayload.category = category.trim();
  }

  if (price !== undefined) {
    const normalizedPrice = parsePrice(price, "price");
    if (normalizedPrice < 10) {
      throw new Error("price must be at least 10");
    }
    updatePayload.price = normalizedPrice;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("At least one field (category or price) must be provided");
  }

  const updated = await Expense.findByIdAndUpdate(id, updatePayload, {
    new: true,
    runValidators: true,
  });

  if (!updated) throw new Error("Expense not found");
  return updated;
}

export async function deleteExpense(id) {
  const deleted = await Expense.findByIdAndDelete(id);
  if (!deleted) {
    throw new Error("Expense not found");
  }

  return { message: "Expense deleted successfully" };
}
