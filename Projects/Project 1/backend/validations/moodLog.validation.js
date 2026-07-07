import { z } from "zod";
import { MOODS } from "../constants/moods.js";
import { SLEEP_HOURS } from "../constants/sleepOptions.js";
import { EMOTION_TAGS } from "../constants/emotionTags.js";

export const createMoodLogSchema = z.object({
  mood: z.enum(MOODS, { error: "Mood must be a valid mood" }),
  tags: z
    .array(z.enum(EMOTION_TAGS, { error: "Tags must be valid emotion tags" }))
    .min(1, "Select at least one tag")
    .max(3, "Select at most 3 tags"),
  reflection: z
    .string({ error: "Reflection is required" })
    .trim()
    .min(1, "Reflection must be a non-empty string")
    .max(150, "Reflection must be at most 150 characters long"),
  sleepHours: z.enum(SLEEP_HOURS, { error: "Sleep hours must be a valid option" }),
});
