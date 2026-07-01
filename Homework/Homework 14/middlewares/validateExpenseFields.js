export function validateExpenseFields(req, res, next) {
  const { category, price } = req.body;

  if (!category || price === undefined) {
    return res.status(400).json({
      message: "category and price are required",
    });
  }

  next();
}
