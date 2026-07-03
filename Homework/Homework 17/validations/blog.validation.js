import { z } from "zod";

export const createBlogSchema = z.object({
  title: z
    .string({ error: "title is required" })
    .trim()
    .min(1, "title must be a non-empty string"),
  content: z
    .string({ error: "content is required" })
    .trim()
    .min(1, "content must be a non-empty string"),
});

export const updateBlogSchema = z
  .object({
    title: z.string().trim().min(1, "title must be a non-empty string").optional(),
    content: z
      .string()
      .trim()
      .min(1, "content must be a non-empty string")
      .optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    error: "At least one field (title or content) must be provided",
  });
