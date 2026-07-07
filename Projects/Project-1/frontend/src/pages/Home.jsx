import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/layout/PageContainer";
import { MoodLogger } from "@/components/mood-logger/MoodLogger";
import { CurrentMoodCard } from "@/components/dashboard/CurrentMoodCard";
import { SleepCard } from "@/components/dashboard/SleepCard";
import { ReflectionCard } from "@/components/dashboard/ReflectionCard";
import { AverageMoodSection } from "@/components/dashboard/AverageMoodSection";
import { MoodTrendsSection } from "@/components/dashboard/MoodTrendsSection";
import { useAuth } from "@/context/AuthContext";
import { getMoodLogs, pickTodaysMoodLog } from "@/services/moodLogs";
import { pickQuote } from "@/constants/moodQuotes";
import { homeSections, homeSection, textStagger, textReveal } from "@/animations/variants";

function ordinalSuffix(day) {
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}

function formatGreetingDate(date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${date.getFullYear()}`;
}

// Figma "Home" — "Mood Logged" (151:423) and "No Mood Check-In" states. Three
// stacked regions:
//   1. Greeting.
//   2. Between the greeting and the components: once today's check-in exists,
//      the Container (Current Mood beside the Sleep/Reflection column; Desktop
//      flex-row, Tablet/Mobile stacked). Before today's check-in, the "Log
//      today's mood" button sits in that same slot instead.
//   3. Main Content — the Average Mood/Sleep stats beside the Mood & Sleep
//      Trends chart (Desktop: 370px stats + flex-1 chart side by side;
//      Tablet/Mobile stacked). Both derive from history and have their own
//      empty states, so they show in either state.
export default function Home() {
  const { user } = useAuth();
  const [isMoodLoggerOpen, setIsMoodLoggerOpen] = useState(false);
  const [moodLogs, setMoodLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Bumping this re-runs the load effect (the "Try again" button).
  const [reloadKey, setReloadKey] = useState(0);

  // "Today's log" has no dedicated endpoint — derive it from the full history.
  const todaysLog = pickTodaysMoodLog(moodLogs);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getMoodLogs()
      .then((logs) => {
        if (active) setMoodLogs(logs);
      })
      .catch(() => {
        // Surface the failure instead of silently showing an empty dashboard —
        // otherwise "couldn't reach the API" looks identical to "no logs yet".
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function handleMoodLoggerClose() {
    setIsMoodLoggerOpen(false);
    try {
      setMoodLogs(await getMoodLogs());
    } catch {
      // Keep the just-submitted state on a refetch failure rather than wiping
      // the dashboard; the next load will reconcile.
    }
  }

  return (
    <PageContainer className="flex flex-col items-center gap-8 pt-10 pb-20 tablet:gap-12">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={homeSections}
        className="flex w-full flex-col items-center gap-8 tablet:gap-12"
      >
        <motion.div
          variants={homeSection}
          className="flex w-full flex-col items-center text-center tablet:w-164"
        >
          <motion.div variants={textStagger} className="flex flex-col items-center gap-2.5">
            <motion.p variants={textReveal} className="text-preset-3 text-blue-600">
              Hello{user?.name ? `, ${user.name}` : ""}!
            </motion.p>
            <motion.h1 variants={textReveal} className="text-preset-1 text-neutral-900">
              How are you feeling today?
            </motion.h1>
            <motion.p variants={textReveal} className="text-preset-6 text-neutral-600">
              {formatGreetingDate(new Date())}
            </motion.p>
          </motion.div>
        </motion.div>

        {/* While the history is loading (a Vercel serverless cold start can
            take a few seconds) or failed, keep this slot in sync with the
            stats below instead of blanking just this region — otherwise the
            page looks half-rendered. */}
        {loading ? (
          <motion.div variants={homeSection} className="flex w-full justify-center py-6">
            <span
              role="status"
              aria-label="Loading your dashboard"
              className="size-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
            />
          </motion.div>
        ) : error ? (
          <motion.div variants={homeSection} className="flex w-full flex-col items-center gap-3 py-6">
            <p className="text-preset-6-regular text-neutral-600">
              We couldn't load your check-ins. Please check your connection and try again.
            </p>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </motion.div>
        ) : todaysLog ? (
          <motion.div variants={homeSection} className="flex w-full flex-col gap-5 desktop:flex-row desktop:gap-8">
            <CurrentMoodCard
              mood={todaysLog.mood}
              quote={pickQuote(todaysLog.mood, todaysLog.id)}
              className="tablet:h-85 desktop:w-167.5"
            />
            <div className="flex w-full flex-col gap-5 desktop:h-85 desktop:flex-1">
              <SleepCard hours={todaysLog.sleepHours} />
              <ReflectionCard reflection={todaysLog.reflection} tags={todaysLog.tags} className="flex-1" />
            </div>
          </motion.div>
        ) : (
          <motion.div variants={homeSection} className="flex w-full justify-center">
            <Button variant="primary" onClick={() => setIsMoodLoggerOpen(true)}>
              Log today's mood
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Desktop: stats (370px) beside the chart, both stretched to the same
          height (the chart is the taller of the two and sets it, so the stat
          cards fill down to match). Tablet/Mobile: stacked full-width. Hidden
          until the history resolves so it doesn't flash empty states mid-load
          while the section above shows a spinner. */}
      {!loading && !error && (
        <div className="flex w-full flex-col gap-8 desktop:flex-row desktop:items-stretch">
          <AverageMoodSection logs={moodLogs} className="desktop:w-92.5 desktop:shrink-0" />
          <MoodTrendsSection logs={moodLogs} className="desktop:min-w-0 desktop:flex-1" />
        </div>
      )}

      <MoodLogger open={isMoodLoggerOpen} onClose={handleMoodLoggerClose} />
    </PageContainer>
  );
}
