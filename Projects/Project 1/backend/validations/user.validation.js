import { z } from "zod";

// Validates only the multipart request's text field — the `avatar` file
// itself is validated by multer (see middlewares/upload.js), not zod.
export const updateProfileSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name must be a non-empty string"),
});
