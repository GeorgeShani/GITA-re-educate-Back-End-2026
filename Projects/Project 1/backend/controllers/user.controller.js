import { updateProfile } from "../services/user.service.js";

export async function updateMyProfile(req, res) {
  try {
    const user = await updateProfile(req.userId, req.body, req.file);
    return res.status(200).json({ user });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
