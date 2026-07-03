import User from "../models/user.model.js";
import Blog from "../models/blog.model.js";
import { uploadFile, deleteFile } from "../lib/cloudinary.js";

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

  // Clean up the profile photo from Cloudinary as well.
  await deleteFile(deletedUser.profilePhotoPublicId);

  return { message: "User deleted successfully" };
}

// Handles both uploading a first photo and replacing an existing one.
export async function updateProfilePhoto(userId, file) {
  if (!file) {
    throw new Error("No photo uploaded");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Remove the previous photo from Cloudinary before storing the new one.
  if (user.profilePhotoPublicId) {
    await deleteFile(user.profilePhotoPublicId);
  }

  const { url, publicId } = await uploadFile(file.buffer, "profiles");

  user.profilePhoto = url;
  user.profilePhotoPublicId = publicId;
  await user.save();

  return {
    message: "Profile photo updated successfully",
    profilePhoto: user.profilePhoto,
  };
}

export async function removeProfilePhoto(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.profilePhotoPublicId) {
    throw new Error("User has no profile photo");
  }

  await deleteFile(user.profilePhotoPublicId);

  user.profilePhoto = null;
  user.profilePhotoPublicId = null;
  await user.save();

  return { message: "Profile photo deleted successfully" };
}
