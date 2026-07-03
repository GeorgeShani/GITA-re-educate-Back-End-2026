import Blog from "../models/blog.model.js";
import User from "../models/user.model.js";

export async function getAllBlogs() {
  return Blog.find()
    .sort({ createdAt: -1 })
    .populate("author", "fullName email");
}

export async function getBlogById(id) {
  const blog = await Blog.findById(id).populate("author", "fullName email");
  if (!blog) {
    throw new Error("Blog not found");
  }
  return blog;
}

export async function createBlog(userId, { title, content }) {
  const blog = await Blog.create({ title, content, author: userId });

  await User.findByIdAndUpdate(userId, { $push: { blogs: blog._id } });

  return blog;
}

export async function updateBlog(id, userId, payload) {
  const blog = await Blog.findById(id);
  if (!blog) {
    throw new Error("Blog not found");
  }

  if (blog.author.toString() !== userId) {
    throw new Error("You are not authorized to modify this blog");
  }

  const updatePayload = {};
  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.content !== undefined) updatePayload.content = payload.content;

  const updatedBlog = await Blog.findByIdAndUpdate(id, updatePayload, {
    new: true,
    runValidators: true,
  });

  return updatedBlog;
}

export async function deleteBlog(id, userId) {
  const blog = await Blog.findById(id);
  if (!blog) {
    throw new Error("Blog not found");
  }

  if (blog.author.toString() !== userId) {
    throw new Error("You are not authorized to modify this blog");
  }

  await Blog.findByIdAndDelete(id);

  // Keep the data relation in sync: remove the blog id from the owner's array.
  await User.findByIdAndUpdate(userId, { $pull: { blogs: blog._id } });

  return { message: "Blog deleted successfully" };
}
