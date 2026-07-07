import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import { signToken } from "../config/jwt.js";

const SALT_ROUNDS = 10;

export async function signUp({ email, password }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, password: hashedPassword });

  // Auto-issues a token immediately, mirroring the frontend mock's signUp()
  // which auto-logs-in on signup (no separate login step).
  const token = signToken({ id: user._id });

  return { token, user };
}

export async function signIn({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Incorrect email or password.");
  }

  const passwordsMatch = await bcrypt.compare(password, user.password);
  if (!passwordsMatch) {
    throw new Error("Incorrect email or password.");
  }

  const token = signToken({ id: user._id });

  return { token, user };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}
