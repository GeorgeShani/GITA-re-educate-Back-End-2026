import { signUp, signIn, getCurrentUser } from "../services/auth.service.js";

export async function register(req, res) {
  try {
    const result = await signUp(req.body);
    return res.status(201).json(result);
  } catch (error) {
    if (error.message === "An account with this email already exists.") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const result = await signIn(req.body);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "Incorrect email or password.") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function current(req, res) {
  try {
    const user = await getCurrentUser(req.userId);
    return res.status(200).json({ user });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
