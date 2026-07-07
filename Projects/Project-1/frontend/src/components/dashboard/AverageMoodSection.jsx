import { motion } from "framer-motion";
import { StatisticsSection } from "@/components/ui/StatisticsSection";
import { StatCard } from "@/components/ui/StatCard";
import { SleepIcon } from "@/assets/icons";
import { MOODS } from "@/constants/moods";
import { computeMoodStats } from "@/utils/moodStats";
import { sectionInView } from "@/animations/variants";
import { cn } from "@/utils/cn";

// Shared comparison copy for both cards — the trend key also drives StatCard's
// arrow icon (increase ↗ / decrease ↘ / same →).
const TREND_DESCRIPTION = {
  increase: "Increase from the previous 5 check-ins",
  decrease: "Decrease from the previous 5 check-ins",
  same: "Same as the previous 5 check-ins",
};

// Figma "Average Mood Section" (desktop 246:1511, tablet 349:3515, mobile
// 350:4596) — a StatisticsSection holding the Average Mood + Average Sleep
// cards. Both derive from the last 5 check-ins via computeMoodStats:
//   - Average Mood: colored by the average mood (MOODS[key].color), the mood
//     illustration + label, and a trend line vs the previous 5.
//   - Average Sleep: always the blue-600 card with white text, the nearest
//     sleep band ("5-6 Hours"), and its own trend line.
// Before 5 check-ins exist, both fall back to the Figma empty state.
export function AverageMoodSection({ logs = [], className }) {
  const stats = computeMoodStats(logs);

  return (
    <motion.div key={logs.length} {...sectionInView} className={cn("w-full", className)}>
      <StatisticsSection>
        {stats ? (
          <>
            <StatCard
              title="Average Mood"
              subtitle="(Last 5 check-ins)"
              background={MOODS[stats.mood.key].color}
              icon={<img src={MOODS[stats.mood.key].iconSm} alt="" className="size-6" />}
              heading={MOODS[stats.mood.key].label}
              trend={stats.mood.trend}
              description={TREND_DESCRIPTION[stats.mood.trend]}
            />
            <StatCard
              title="Average Sleep"
              subtitle="(Last 5 check-ins)"
              background="bg-blue-600"
              textColor="text-neutral-0"
              icon={<SleepIcon className="size-6 opacity-70" />}
              heading={`${stats.sleep.band} Hours`}
              trend={stats.sleep.trend}
              description={TREND_DESCRIPTION[stats.sleep.trend]}
              mutedDescription
            />
          </>
        ) : (
          <>
            <StatCard
              title="Average Mood"
              subtitle="(Last 5 check-ins)"
              background="bg-blue-100"
              radius="rounded-2xl"
              heading="Keep tracking!"
              description="Log 5 check-ins to see your average mood."
              mutedDescription
            />
            <StatCard
              title="Average Sleep"
              subtitle="(Last 5 check-ins)"
              background="bg-blue-100"
              radius="rounded-2xl"
              heading="Not enough data yet!"
              description="Track 5 nights to view average sleep."
              mutedDescription
            />
          </>
        )}
      </StatisticsSection>
    </motion.div>
  );
}
