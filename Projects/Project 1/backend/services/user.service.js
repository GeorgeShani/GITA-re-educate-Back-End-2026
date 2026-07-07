import User from "../models/user.model.js";
import { uploadFile, deleteFile } from "../lib/cloudinary.js";

const AVATAR_FOLDER = "mood-tracker/avatars";

// Replaces both completeOnboarding() and updateProfile() from the frontend
// mock — from the API's point of view they're the same operation. If
// hasOnboarded was false, this call flips it to true. See API_SPEC.md's
// "Users" section for why there's deliberately one endpoint, not two.
export async function updateProfile(userId, { name }, file) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.name = name;

  if (file) {
    // Remove the previous avatar from Cloudinary before storing the new one.
    if (user.avatarPublicId) {
      await deleteFile(user.avatarPublicId);
    }
    const { url, publicId } = await uploadFile(file.buffer, AVATAR_FOLDER);
    user.avatarUrl = url;
    user.avatarPublicId = publicId;
  }

  if (!user.hasOnboarded) {
    user.hasOnboarded = true;
  }

  await user.save();
  return user;
}
