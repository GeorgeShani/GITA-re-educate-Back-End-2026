import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import { signToken } from "../config/jwt.js";

const SALT_ROUNDS = 10;

export async function registerUser({ fullName, email, password, birthDate }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    fullName,
    email,
    password: hashedPassword,
    birthDate,
  });

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    birthDate: user.birthDate,
  };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Email or password is invalid");
  }

  const passwordsMatch = await bcrypt.compare(password, user.password);
  if (!passwordsMatch) {
    throw new Error("Email or password is invalid");
  }

  const token = signToken({ id: user._id });

  return token;
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId)
    .select("-password")
    .populate("blogs");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
