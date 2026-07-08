import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MOODS } from "@/constants/moods";
import { SLEEP_OPTIONS } from "@/constants/sleepOptions";
import { SleepIcon } from "@/assets/icons";
import { sectionInView, barsStagger, barReveal, popIn } from "@/animations/variants";
import { cn } from "@/utils/cn";

// Popover sizing (Figma nodes 396:6651/434:7873/434:8097 — identical 175px
// width across all 3 breakpoints; positioned to the left of the hovered bar
// per user preference rather than Figma's above-the-bar placement). Rendered
// via a body portal with `position: fixed` computed from the hovered bar's
// own bounding rect, so it escapes both the chart's horizontal scroll
// clipping and any transform-based containing block from the section's
// enter animation — neither of which a plain `absolute` popover could escape.
const POPOVER_WIDTH = 175;
const POPOVER_GAP = 12;
const VIEWPORT_MARGIN = 12;

// Minimum size of the visible window: how many of the most-recent days play
// the reveal-cascade animation and sit in view by default. Older history is
// still rendered (statically, no animation) so the user can scroll left past
// this window to see their full progress — it just isn't part of the initial
// "look here" reveal. The window grows past this floor to fill a wider chart
// (see `visibleDays` below), so a full-width chart doesn't trail off into empty
// space; it never shrinks below this.
const DAYS_SHOWN = 11;

// One day-column's footprint: the bar/label width (`w-10` = 40px) plus the
// inter-column gap (`gap-4` = 16px). Used to work out how many columns fit the
// chart's current width.
const COLUMN_WIDTH = 40;
const COLUMN_GAP = 16;

// The most columns that fit `width` px at the fixed per-column footprint:
// n columns span n*COLUMN_WIDTH + (n-1)*COLUMN_GAP, so n = (width + gap) / (col + gap).
function daysThatFit(width) {
  return Math.floor((width + COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP));
}

// Sleep-hours band -> bar height as a fraction of the chart's drawing area,
// evenly spaced top-to-bottom in the same order as SLEEP_OPTIONS (9+ down to
// 0-2). These land within a few px of the exact heights confirmed in Figma's
// populated examples (263/214/165/104px out of a ~268px drawing area is
// ~100/80/60/40% — the "0-2 hours" band was never shown populated in any
// Figma example, so its 20% is a reasonable extrapolation of that pattern).
const BAR_HEIGHT_CLASS = {
  "9+": "h-full",
  "7-8": "h-4/5",
  "5-6": "h-3/5",
  "3-4": "h-2/5",
  "0-2": "h-1/5",
};

// Local calendar-day key (not toISOString/UTC) — every other date computation
// here (lastNDays, daysSince, the axis labels below) operates in local time.
// Keying by UTC instead would shift by a day for anyone ahead of UTC (local
// midnight converts to the previous UTC day), silently misaligning which
// column a log lands in and making an adjacent day look empty.
function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastNDays(n) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (n - 1 - i));
    return date;
  });
}

// Every calendar day from the earliest log through today (inclusive) — the
// full history to scroll through, not just a fixed recent window.
function daysSince(earliestDate) {
  const start = new Date(earliestDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayCount = Math.round((today - start) / 86400000) + 1;
  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

function BarPill({ log, onHoverStart, onHoverEnd }) {
  if (!log) return null;
  return (
    <div
      onMouseEnter={(event) => onHoverStart(log, event.currentTarget.getBoundingClientRect())}
      onMouseLeave={onHoverEnd}
      className={cn("relative w-10 rounded-full", BAR_HEIGHT_CLASS[log.sleepHours], MOODS[log.mood].color)}
    >
      <img src={MOODS[log.mood].iconSm} alt="" className="absolute inset-x-0 top-1.5 mx-auto size-6" />
    </div>
  );
}

// Figma "Popover" (396:6651 desktop, 434:7873 tablet, 434:8097 mobile) content
// and sizing, adapted to sit to the LEFT of the hovered bar instead of above
// it. `rect` is the hovered bar's own bounding rect (just the colored pill),
// captured on mouseenter:
//   - Horizontal: anchored via `right edge = bar's left edge - gap`, clamped
//     so it never runs off the left of the viewport.
//   - Vertical: centered on the bar's vertical center via `top: rect.top +
//     rect.height / 2` + a `-translate-y-1/2` transform — like horizontal
//     centering with `left-1/2 -translate-x-1/2`, this centers regardless of
//     the popover's own (content-dependent) height, no measurement needed.
// Since it's always exactly vertically centered on the bar (no vertical
// clamping), the pointer/caret can just sit at a fixed spot on the box's own
// right edge, vertically centered — no per-hover offset math needed there.
// Uses MOODS[mood].icon (the original full-color mood illustration), not the
// small monochrome iconSm used on the bar itself.
function MoodBarPopover({ log, rect }) {
  const sleepLabel = SLEEP_OPTIONS.find((option) => option.value === log.sleepHours)?.label ?? "—";
  const left = Math.max(rect.left - POPOVER_WIDTH - POPOVER_GAP, VIEWPORT_MARGIN);
  const top = rect.top + rect.height / 2;

  return createPortal(
    <motion.div
      {...popIn}
      className="pointer-events-none fixed z-popover flex w-43.75 -translate-y-1/2 flex-col gap-3 rounded-lg border border-blue-100 bg-neutral-0 p-3 shadow-dropdown"
      style={{ left, top }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-preset-8 text-neutral-600">Mood</p>
        <div className="flex items-center gap-2">
          <img src={MOODS[log.mood].icon} alt="" className="size-4 shrink-0" />
          <p className="text-preset-7 text-neutral-900">{MOODS[log.mood].label}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-preset-8 text-neutral-600">Sleep</p>
        <p className="text-preset-7 text-neutral-900">{sleepLabel}</p>
      </div>
      {log.reflection && (
        <div className="flex flex-col gap-1.5">
          <p className="text-preset-8 text-neutral-600">Reflection</p>
          <p className="text-preset-9 text-neutral-900">{log.reflection}</p>
        </div>
      )}
      {log.tags?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-preset-8 text-neutral-600">Tags</p>
          <p className="text-preset-9 text-neutral-900">{log.tags.join(", ")}</p>
        </div>
      )}
      <div className="absolute -right-1 top-1/2 size-2 -translate-y-1/2 rotate-45 border-r border-t border-blue-100 bg-neutral-0" />
    </motion.div>,
    document.body,
  );
}

// Figma "Trends Section" — the empty (246:1974/349:2596/339:13576),
// few-logged (396:5141/5356, 432:5921) and fully-populated/scrollable
// (432:6696/7078/7271) states all turn out to be the SAME component: a
// day-by-day window where each day either has a bar (a mood log exists for
// that calendar date) or doesn't. Bar color tracks the mood
// (MOODS[mood].color — confirmed identical to this chart's own
// indigo/green/red/blue/amber set) and bar height tracks the sleep-hours
// band; the two vary independently across every populated Figma example
// (e.g. the same mood color shows up at two different bar heights), so they
// aren't derived from each other.
//
// Extended beyond the fixed 11-day Figma window: the full range from the
// earliest log to today renders so scrolling left reveals a user's entire
// history, not just the last 11 days. Only the most recent DAYS_SHOWN days
// play the reveal-cascade animation and sit in view on first render (via an
// auto-scroll-to-the-end effect) — older days are always-visible/static, so
// the "look here" moment stays on the current window instead of a long
// animation queue for history the user has to scroll to find.
//
// Only the day columns scroll horizontally — the sleep-hour axis sits
// outside that scroll region, exactly as structured in Figma (there, the
// axis labels are a sibling of the `overflow-clip`'d "Bars Content" wrapper,
// not inside it).
export function MoodTrendsSection({ logs = [], className }) {
  const scrollRef = useRef(null);
  const recentStartRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  // The visible window sizes itself to the chart's current width (at least
  // DAYS_SHOWN) so a wide, full-width chart is filled with day-columns instead
  // of leaving empty space to the right. Measured from the scroll container and
  // kept in sync on resize (e.g. the desktop side-by-side ↔ stacked reflow).
  const [visibleDays, setVisibleDays] = useState(DAYS_SHOWN);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const measure = () => setVisibleDays(Math.max(DAYS_SHOWN, daysThatFit(container.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function handleHoverStart(log, rect) {
    setHoveredBar({ log, rect });
  }
  function handleHoverEnd() {
    setHoveredBar(null);
  }

  const earliestLog = logs.reduce(
    (earliest, log) => (!earliest || log.loggedAt < earliest.loggedAt ? log : earliest),
    null,
  );
  // The range always spans at least `visibleDays` days (enough to fill the
  // chart width), even when the earliest log is more recent than that — so a
  // handful of recent check-ins still shows bars only on the right, with the
  // emptier days before them rendered too (Figma "Few Moods Logged"), rather
  // than the chart shrinking to fit just the days that have data. It extends
  // further back than that floor when real history goes back further.
  const rangeStart = earliestLog
    ? new Date(Math.min(new Date(earliestLog.loggedAt).getTime(), lastNDays(visibleDays)[0].getTime()))
    : null;
  const days = rangeStart ? daysSince(rangeStart) : lastNDays(visibleDays);
  const historyDays = days.slice(0, -visibleDays);
  const recentDays = days.slice(-visibleDays);

  const logsByDay = new Map();
  for (const log of logs) {
    logsByDay.set(dateKey(new Date(log.loggedAt)), log);
  }

  // Land on the last DAYS_SHOWN days by default; re-runs when the range grows
  // (a new check-in extends it) so the newest day stays in view. Scrolls to
  // the exact boundary bar's offsetLeft rather than scrollWidth (max scroll)
  // — scrollWidth reveals however many bars happen to fit the container's
  // width, which is rarely a clean multiple of one bar's width and so was
  // clipping a sliver of the 12th-from-last bar in at the left edge.
  useEffect(() => {
    const container = scrollRef.current;
    const marker = recentStartRef.current;
    if (container && marker) container.scrollLeft = marker.offsetLeft;
  }, [days.length]);

  return (
    <motion.div
      key={logs.length}
      {...sectionInView}
      className={cn(
        "flex w-full flex-col gap-8 rounded-2xl border border-blue-100 bg-neutral-0 px-4 py-5 tablet:p-6 desktop:p-8",
        className,
      )}
    >
      <p className="text-preset-3 text-neutral-900">Mood and sleep trends</p>

      <div className="flex w-full items-start gap-4">
        <div className="flex h-67 w-fit shrink-0 flex-col justify-between">
          {SLEEP_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-1.5">
              <SleepIcon className="size-2.5 shrink-0 text-neutral-600" />
              <p className="text-preset-9 whitespace-nowrap text-neutral-600">{option.label}</p>
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          onScroll={handleHoverEnd}
          className="scrollbar-none min-w-0 flex-1 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
        >
          <motion.div
            className="relative flex h-67 w-fit min-w-full items-end gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: "some" }}
            variants={barsStagger}
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {SLEEP_OPTIONS.map((option) => (
                <div key={option.value} className="h-px w-full bg-blue-100 opacity-30" />
              ))}
            </div>

            {historyDays.map((date) => (
              <div key={dateKey(date)} className="flex h-full w-10 shrink-0 items-end justify-center">
                <BarPill
                  log={logsByDay.get(dateKey(date))}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                />
              </div>
            ))}

            {recentDays.map((date, index) => (
              <motion.div
                key={dateKey(date)}
                ref={index === 0 ? recentStartRef : undefined}
                variants={barReveal}
                style={{ transformOrigin: "bottom" }}
                className="flex h-full w-10 shrink-0 items-end justify-center"
              >
                <BarPill
                  log={logsByDay.get(dateKey(date))}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                />
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-3 flex w-fit min-w-full gap-4">
            {days.map((date) => (
              <div key={dateKey(date)} className="flex w-10 shrink-0 flex-col items-center gap-1.5 text-center">
                <p className="text-preset-9 text-neutral-600">{date.toLocaleDateString("en-US", { month: "long" })}</p>
                <p className="text-preset-8 text-neutral-900">{String(date.getDate()).padStart(2, "0")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hoveredBar && <MoodBarPopover key={hoveredBar.log.id} log={hoveredBar.log} rect={hoveredBar.rect} />}
      </AnimatePresence>
    </motion.div>
  );
}
