import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 10,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  }
);

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
