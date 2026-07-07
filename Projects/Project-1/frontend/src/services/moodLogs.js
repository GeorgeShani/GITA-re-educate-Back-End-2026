// Mood-log data access against the Mood Tracker API. `user` and `loggedAt` are
// set server-side from the authenticated request — never sent from the client
// (the old `userEmail` field is gone).

import { request } from "@/lib/apiClient";

// GET /mood-logs — all of the current user's logs, oldest first.
export async function getMoodLogs() {
  return request("/mood-logs");
}

// POST /mood-logs
export async function addMoodLog({ mood, tags, reflection, sleepHours }) {
  const { log } = await request("/mood-logs", {
    method: "POST",
    body: { mood, tags, reflection, sleepHours },
  });
  return log;
}

// The check-in logged today (the most recent one, if logged more than once),
// or null. Derived client-side from the oldest-first list returned by
// getMoodLogs(), since the API has no dedicated "today" endpoint. Drives
// Home's two states: with today's log the dashboard shows the Current Mood /
// Sleep / Reflection cards; without it, the "Log today's mood" button. "Today"
// is the local calendar day.
export function pickTodaysMoodLog(logs) {
  const today = new Date().toDateString();
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (new Date(logs[i].loggedAt).toDateString() === today) return logs[i];
  }
  return null;
}
