export function validateExpenseFields(req, res, next) {
  const { category, price, amount } = req.body;
  const incomingPrice = price ?? amount;

  if (!category || incomingPrice === undefined) {
    return res.status(400).json({
      message: "category and price (or amount) are required",
    });
  }

  if (typeof category !== "string" || !category.trim()) {
    return res.status(400).json({
      message: "category must be a non-empty string",
    });
  }

  next();
}
