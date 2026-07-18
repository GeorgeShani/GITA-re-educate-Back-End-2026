import { UserModel, type User } from "../models/user.model";

interface UpdateUserInput {
  username?: string;
}

/** Stable key identifying one question across the whole quiz set. */
export function questionKey(quizId: number, questionId: number): string {
  return `${quizId}:${questionId}`;
}

/**
 * Data-access layer for users. Everything that touches the `users` collection
 * goes through here so controllers and socket handlers stay thin.
 */
export const userService = {
  createUser(username: string) {
    return UserModel.create({ username });
  },

  getUsers() {
    return UserModel.find().sort({ score: -1, createdAt: 1 });
  },

  getUserById(id: string) {
    return UserModel.findById(id);
  },

  updateUser(id: string, data: UpdateUserInput) {
    return UserModel.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    });
  },

  deleteUser(id: string) {
    return UserModel.findByIdAndDelete(id);
  },

  /**
   * Atomically award points for a question the user has not scored on yet.
   * The `answeredQuestions` guard is applied inside the query so two rapid
   * submissions for the same question can't both score.
   * @param key the `questionKey(quizId, questionId)` being answered.
   * @returns the updated user, or `null` if the question was already answered
   *          (or the user does not exist).
   */
  awardPointsForQuestion(
    userId: string,
    key: string,
    points: number
  ): Promise<User | null> {
    return UserModel.findOneAndUpdate(
      { _id: userId, answeredQuestions: { $ne: key } },
      { $inc: { score: points }, $addToSet: { answeredQuestions: key } },
      { returnDocument: "after" }
    );
  },
};
