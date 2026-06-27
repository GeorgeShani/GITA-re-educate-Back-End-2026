import mongoose from "mongoose";

export function validateMongoId(req, res, next) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid expense ID format" });
  }

  next();
}
