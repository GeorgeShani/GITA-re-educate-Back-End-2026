import mongoose from "mongoose";
import { MOODS } from "../constants/moods.js";
import { SLEEP_HOURS } from "../constants/sleepOptions.js";
import { EMOTION_TAGS } from "../constants/emotionTags.js";

const moodLogSchema = new mongoose.Schema(
  {
    // ObjectId reference, set only from the authenticated request (req.userId,
    // populated by the isAuth middleware after verifying the JWT) — never
    // accepted from client input. See API_SPEC.md's "Data models" section.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mood: {
      type: String,
      required: true,
      enum: MOODS,
    },
    tags: {
      type: [{ type: String, enum: EMOTION_TAGS }],
      validate: {
        validator: (tags) => tags.length >= 1 && tags.length <= 3,
        message: "Select between 1 and 3 tags",
      },
    },
    reflection: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    sleepHours: {
      type: String,
      required: true,
      enum: SLEEP_HOURS,
    },
    loggedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Common query: a user's logs, chronological.
moodLogSchema.index({ user: 1, loggedAt: -1 });

moodLogSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

const MoodLog = mongoose.model("MoodLog", moodLogSchema);

export default MoodLog;
