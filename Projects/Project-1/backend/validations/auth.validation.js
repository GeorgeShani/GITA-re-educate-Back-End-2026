import { z } from "zod";

export const signUpSchema = z.object({
  email: z.email({ error: "Email must be a valid email address" }).trim(),
  password: z
    .string({ error: "Password is required" })
    .min(6, "Password must be at least 6 characters long"),
});

export const signInSchema = z.object({
  email: z.email({ error: "Email must be a valid email address" }).trim(),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
});
