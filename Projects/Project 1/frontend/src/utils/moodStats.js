import { SLEEP_OPTIONS } from "@/constants/sleepOptions";

// How many most-recent check-ins each average summarizes — the Figma cards
// literally read "(Last 5 check-ins)".
export const STATS_WINDOW = 5;

// verySad(1) .. veryHappy(5). Higher is a "better" mood, so a rising average
// reads as an upward ("increase") trend — matching the Average Mood card's
// arrow direction in Figma. Kept as an explicit map (not MOODS object order)
// so mood ordering is unambiguous regardless of how MOODS is declared.
const MOOD_SCORE = { verySad: 1, sad: 2, neutral: 3, happy: 4, veryHappy: 5 };
const SCORE_TO_MOOD = ["verySad", "sad", "neutral", "happy", "veryHappy"];

// Representative hours per sleep band, used to average bands numerically and
// snap back to the closest one. "0-2" and "9+" are open-ended edges, so 1 and
// 9.5 are reasonable stand-ins for their midpoints.
const SLEEP_MIDPOINT = { "0-2": 1, "3-4": 3.5, "5-6": 5.5, "7-8": 7.5, "9+": 9.5 };

function average(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

// Compares a window average against the window before it. `null` previous
// (fewer than 2 full windows of history) reads as "same" — the neutral state,
// since there's nothing earlier to have moved away from.
function trendBetween(current, previous) {
  if (previous == null) return "same";
  if (current > previous) return "increase";
  if (current < previous) return "decrease";
  return "same";
}

function nearestSleepBand(avgHours) {
  let closest = SLEEP_OPTIONS[0].value;
  let smallestDiff = Infinity;
  for (const option of SLEEP_OPTIONS) {
    const diff = Math.abs(SLEEP_MIDPOINT[option.value] - avgHours);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = option.value;
    }
  }
  return closest;
}

// Derives the Average Mood + Average Sleep card data from a chronological
// (oldest-first, as stored by addMoodLog) list of mood logs. Returns null
// until there are at least STATS_WINDOW check-ins, which the dashboard renders
// as the "keep tracking" empty state instead of a computed average.
export function computeMoodStats(logs) {
  if (!logs || logs.length < STATS_WINDOW) return null;

  const recent = logs.slice(-STATS_WINDOW);
  const prior = logs.slice(-STATS_WINDOW * 2, -STATS_WINDOW);

  const recentMood = average(recent.map((log) => MOOD_SCORE[log.mood]));
  const priorMood = prior.length ? average(prior.map((log) => MOOD_SCORE[log.mood])) : null;

  const recentSleep = average(recent.map((log) => SLEEP_MIDPOINT[log.sleepHours]));
  const priorSleep = prior.length ? average(prior.map((log) => SLEEP_MIDPOINT[log.sleepHours])) : null;

  return {
    mood: {
      key: SCORE_TO_MOOD[Math.round(recentMood) - 1],
      trend: trendBetween(recentMood, priorMood),
    },
    sleep: {
      band: nearestSleepBand(recentSleep),
      trend: trendBetween(recentSleep, priorSleep),
    },
  };
}
