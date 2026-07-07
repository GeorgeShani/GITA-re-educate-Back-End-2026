// Mock mood-log service — localStorage only, mirrors services/auth.js's
// pattern exactly (same mock/localStorage data-layer decision, swap-in seam
// for the real backend later). Entries carry a flat `userEmail` field rather
// than a per-user storage key, matching how completeOnboarding() already
// fetches getCurrentUser() rather than introducing a new keying scheme.

const LOGS_KEY = "mood-tracker:mood-logs";

function readLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

export function addMoodLog({ mood, tags, reflection, sleepHours, userEmail }) {
  const logs = readLogs();
  const entry = {
    id: crypto.randomUUID(),
    mood,
    tags,
    reflection,
    sleepHours,
    userEmail,
    loggedAt: new Date().toISOString(),
  };
  logs.push(entry);
  writeLogs(logs);
  return entry;
}

export function getMoodLogs() {
  return readLogs();
}

// The check-in logged today (the most recent one, if logged more than once),
// or null. Drives Home's two states: with today's log the dashboard shows the
// Current Mood / Sleep / Reflection cards; without it, the "Log today's mood"
// button. "Today" is the local calendar day.
export function getTodaysMoodLog() {
  const logs = readLogs();
  const today = new Date().toDateString();
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (new Date(logs[i].loggedAt).toDateString() === today) return logs[i];
  }
  return null;
}
