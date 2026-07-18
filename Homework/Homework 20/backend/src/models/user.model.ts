import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * Instagram-style username rules (applied after the value is lowercased):
 *  - only letters, numbers, periods and underscores
 *  - 1-30 characters
 *  - cannot start or end with a period
 *  - cannot contain two periods in a row
 */
export const USERNAME_REGEX = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{1,30}$/;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [30, "Username must be at most 30 characters long"],
      validate: {
        validator: (value: string) => USERNAME_REGEX.test(value),
        message:
          "Username may only contain letters, numbers, periods and underscores, cannot start or end with a period, and cannot contain consecutive periods",
      },
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Keys ("quizId:questionId") of questions the user has already scored on,
    // preventing farming points by re-submitting the same question repeatedly.
    answeredQuestions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model("User", userSchema);
