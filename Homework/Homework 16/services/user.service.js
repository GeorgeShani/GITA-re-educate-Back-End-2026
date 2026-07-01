import User from "../models/user.model.js";
import Blog from "../models/blog.model.js";

export async function getAllUsers() {
  return User.find().select("-password").populate("blogs");
}

export async function getUserById(id) {
  const user = await User.findById(id).select("-password").populate("blogs");
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

export async function deleteUser(id, userId) {
  if (id !== userId) {
    throw new Error("You are not authorized to delete this user");
  }

  const deletedUser = await User.findByIdAndDelete(id);
  if (!deletedUser) {
    throw new Error("User not found");
  }

  // When a user is removed, all blogs owned by them must be deleted.
  await Blog.deleteMany({ author: id });

  return { message: "User deleted successfully" };
}
