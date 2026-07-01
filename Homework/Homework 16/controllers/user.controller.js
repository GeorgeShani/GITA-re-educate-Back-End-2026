import {
  getAllUsers,
  getUserById,
  deleteUser,
} from "../services/user.service.js";

export async function listUsers(req, res) {
  try {
    const users = await getAllUsers();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getUser(req, res) {
  try {
    const user = await getUserById(req.params.id);
    return res.status(200).json(user);
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function removeUser(req, res) {
  try {
    const result = await deleteUser(req.params.id, req.userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "You are not authorized to delete this user") {
      return res.status(403).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
