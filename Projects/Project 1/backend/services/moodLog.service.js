import MoodLog from "../models/moodLog.model.js";

export async function createMoodLog(userId, { mood, tags, reflection, sleepHours }) {
  return MoodLog.create({
    user: userId,
    mood,
    tags,
    reflection,
    sleepHours,
    loggedAt: new Date(),
  });
}

// All of the current user's logs, oldest first — matches the order the
// frontend mock's array is already in, and is what both the Trends chart and
// the Average Mood/Sleep stats expect to iterate over.
export async function getMoodLogs(userId) {
  return MoodLog.find({ user: userId }).sort({ loggedAt: 1 });
}
