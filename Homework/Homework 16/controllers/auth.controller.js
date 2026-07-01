import {
  registerUser,
  loginUser,
  getCurrentUser,
} from "../services/auth.service.js";

export async function register(req, res) {
  try {
    const user = await registerUser(req.body);
    return res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    if (error.message === "User already exists") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const token = await loginUser(req.body);
    return res.status(200).json({ token });
  } catch (error) {
    if (error.message === "Email or password is invalid") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function current(req, res) {
  try {
    const user = await getCurrentUser(req.userId);
    return res.status(200).json(user);
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
