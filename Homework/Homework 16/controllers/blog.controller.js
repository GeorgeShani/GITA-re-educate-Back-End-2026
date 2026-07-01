import {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../services/blog.service.js";

export async function listBlogs(req, res) {
  try {
    const blogs = await getAllBlogs();
    return res.status(200).json(blogs);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getBlog(req, res) {
  try {
    const blog = await getBlogById(req.params.id);
    return res.status(200).json(blog);
  } catch (error) {
    if (error.message === "Blog not found") {
      return res.status(404).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function createNewBlog(req, res) {
  try {
    const blog = await createBlog(req.userId, req.body);
    return res.status(201).json(blog);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateExistingBlog(req, res) {
  try {
    const blog = await updateBlog(req.params.id, req.userId, req.body);
    return res
      .status(200)
      .json({ message: "Blog updated successfully", blog });
  } catch (error) {
    if (error.message === "Blog not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "You are not authorized to modify this blog") {
      return res.status(403).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function removeBlog(req, res) {
  try {
    const result = await deleteBlog(req.params.id, req.userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "Blog not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "You are not authorized to modify this blog") {
      return res.status(403).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}
