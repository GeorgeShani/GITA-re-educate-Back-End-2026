import { z } from "zod";

export const registerSchema = z.object({
  fullName: z
    .string({ error: "fullName is required" })
    .trim()
    .min(2, "fullName must be at least 2 characters long"),
  email: z.email({ error: "email must be a valid email address" }).trim(),
  password: z
    .string({ error: "password is required" })
    .min(6, "password must be at least 6 characters long"),
  birthDate: z.coerce
    .date({ error: "birthDate must be a valid date" })
    .max(new Date(), "birthDate cannot be in the future"),
});

export const loginSchema = z.object({
  email: z.email({ error: "email must be a valid email address" }).trim(),
  password: z
    .string({ error: "password is required" })
    .min(1, "password is required"),
});
