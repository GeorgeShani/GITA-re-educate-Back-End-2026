import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MOODS } from "@/constants/moods";
import { SLEEP_OPTIONS } from "@/constants/sleepOptions";
import { SleepIcon } from "@/assets/icons";
import { sectionInView, barsStagger, barReveal, barRevealOnScroll, popIn } from "@/animations/variants";
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
// inter-column gap (`gap-4.25` = 17px). Used to work out how many columns fit
// the chart's current width — must stay in sync with the `gap-4.25` on the bar
// row and the label row below.
const COLUMN_WIDTH = 40;
const COLUMN_GAP = 17;

// The most columns that fit `width` px at the fixed per-column footprint:
// n columns span n*COLUMN_WIDTH + (n-1)*COLUMN_GAP, so n = (width + gap) / (col + gap).
function daysThatFit(width) {
  return Math.floor((width + COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP));
}

// Sleep-hours band -> how far up from the chart's bottom edge it sits, as a
// fraction of the h-67 drawing area. This is the SINGLE source for both the
// bars (their height) and the axis gridlines/labels (their vertical
// position) — see the `top` styles below — so a bar's top always lands
// exactly on its own gridline by construction, instead of the two being laid
// out independently (previously the axis used an evenly-spaced
// `justify-between`, which doesn't match these fractions and visibly put
// bars a bit above their line). Confirmed pixel-exact against Figma's
// populated bar heights (263/214/165/104px out of a ~268px drawing area is
// ~100/80/60/40% — the "0-2 hours" band was never shown populated in any
// Figma example, so its 20% is a reasonable extrapolation of that pattern).
const SLEEP_BAND_FRACTION = {
  "9+": 1,
  "7-8": 0.8,
  "5-6": 0.6,
  "3-4": 0.4,
  "0-2": 0.2,
};

// The axis label / gridline offset for a band: distance from the TOP of the
// drawing area, as a percentage — the inverse of its bottom-up bar fraction.
function axisTopPercent(sleepValue) {
  return `${(1 - SLEEP_BAND_FRACTION[sleepValue]) * 100}%`;
}

// Local calendar-day key (not toISOString/UTC) — every other date computation
// here (lastNDays, the axis labels below) operates in local time. Keying by
// UTC instead would shift by a day for anyone ahead of UTC (local midnight
// converts to the previous UTC day), silently misaligning which column a log
// lands in and making an adjacent day look empty.
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

function BarPill({ log, onHoverStart, onHoverEnd }) {
  if (!log) return null;
  return (
    <div
      onMouseEnter={(event) => onHoverStart(log, event.currentTarget.getBoundingClientRect())}
      onMouseLeave={onHoverEnd}
      style={{ height: `${SLEEP_BAND_FRACTION[log.sleepHours] * 100}%` }}
      className={cn("relative w-10 rounded-full", MOODS[log.mood].color)}
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
// Extended beyond the fixed 11-day Figma window: scrolling left reveals a
// user's entire history, not just the last 11 days. Only the most recent
// DAYS_SHOWN/visibleDays days are literal calendar days — including empty
// ones, exactly like Figma's "Few Moods Logged" example — since that's the
// window where "did I log yesterday?" matters. Further back, only days that
// actually have a check-in are rendered (see `historyDays` below): a user
// who logs sporadically (weekly, monthly) would otherwise have to scroll
// through dozens or hundreds of empty columns to reach real data, which
// defeats the point of keeping history scrollable at all. Those bars play the
// reveal-cascade animation individually as they're scrolled into view, rather
// than all at once on load — older days are not part of the initial "look
// here" moment.
//
// Only the day columns scroll horizontally — the sleep-hour axis sits
// outside that scroll region, exactly as structured in Figma (there, the
// axis labels are a sibling of the `overflow-clip`'d "Bars Content" wrapper,
// not inside it).
export function MoodTrendsSection({ logs = [], className }) {
  const scrollRef = useRef(null);
  const todayRef = useRef(null);
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

  // The recent window is always literal trailing calendar days — including
  // empty, unlogged ones (Figma "Few Moods Logged") — so "did I log
  // yesterday?" stays visible for the stretch that actually matters.
  const recentDays = lastNDays(visibleDays);
  const recentDayKeys = new Set(recentDays.map(dateKey));

  // Latest log per calendar day (a day logged more than once collapses to its
  // most recent entry — same "last one wins" rule Home's todaysLog uses).
  const logsByDay = new Map();
  for (const log of logs) {
    logsByDay.set(dateKey(new Date(log.loggedAt)), log);
  }

  // History (left of the recent window) renders only days that actually have
  // a check-in — no filler for the days in between, however many real days
  // that spans. A sporadic logger (weekly, monthly) would otherwise scroll
  // through huge stretches of empty columns to reach an old entry; skipping
  // the gaps keeps the chart compact no matter how spread out their logging
  // history is. Each bar's own date is still shown on hover/label, so no
  // information is lost — the columns just aren't spaced proportionally to
  // real elapsed time anymore once you're scrolled past the recent window.
  const historyDays = [...logsByDay.entries()]
    .filter(([key]) => !recentDayKeys.has(key))
    .map(([, log]) => new Date(log.loggedAt))
    .sort((a, b) => a - b);

  const days = [...historyDays, ...recentDays];

  // Land on today by default; re-runs when the range grows (a new check-in
  // extends it) so the newest day stays in view. Aligns TODAY'S OWN right edge
  // with the container's right edge — not scrollWidth (max scroll), which
  // reveals however many bars happen to fit the container's width and can clip
  // a sliver of the boundary bar. That matters more here than it used to:
  // scrolling to the *start* of the recent window (the old approach) assumed
  // the window fit the container, true on desktop where visibleDays is sized
  // to fit, but not on mobile, where visibleDays is floored at DAYS_SHOWN and
  // routinely doesn't fit a narrow screen — todayRef then wouldn't be it view
  // at all, forcing extra scrolling just to see your own latest check-in. This
  // routinely doesn't fit a narrow screen — today then wouldn't be in view at
  // all, forcing extra scrolling just to see your own latest check-in. This
  // way any clipped sliver falls on the older, less important edge instead.
  //
  // Must be a layout effect (runs before paint): the history bars reveal via
  // whileInView against this same scroll container, so the scroll has to be at
  // the recent window *before* their in-view observers first evaluate —
  // otherwise, at the initial scrollLeft of 0, the leftmost history bars are on
  // screen and animate in parallel with the recent cascade instead of waiting
  // to be scrolled to.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const marker = todayRef.current;
    if (container && marker) {
      container.scrollLeft = marker.offsetLeft + marker.offsetWidth - container.clientWidth;
    }
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
        {/* w-17 (68px) matches Figma's "Sleep Bar" column exactly — needed now
            that the labels are absolutely positioned and can no longer size
            this container themselves the way in-flow children with w-fit
            could. */}
        <div className="relative h-67 w-17 shrink-0">
          {SLEEP_OPTIONS.map((option) => (
            <div
              key={option.value}
              style={{ top: axisTopPercent(option.value) }}
              className="absolute left-0 flex -translate-y-1/2 items-center gap-1.5"
            >
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
            className="relative flex h-67 w-fit min-w-full items-end justify-end gap-4.25"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: "some" }}
            variants={barsStagger}
          >
            <div className="pointer-events-none absolute inset-0">
              {SLEEP_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  style={{ top: axisTopPercent(option.value) }}
                  className="absolute inset-x-0 h-px bg-blue-100 opacity-30"
                />
              ))}
            </div>

            {/* Older history bars reveal individually as they're scrolled into
                view (root = the horizontal scroll container), rather than all
                at once. Distinct variant labels keep them independent of the
                barsStagger parent above. */}
            {historyDays.map((date) => (
              <motion.div
                key={dateKey(date)}
                initial="offscreen"
                whileInView="onscreen"
                viewport={{ once: true, root: scrollRef }}
                variants={barRevealOnScroll}
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

            {recentDays.map((date, index) => (
              <motion.div
                key={dateKey(date)}
                ref={index === recentDays.length - 1 ? todayRef : undefined}
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

          <div className="mt-3 flex w-fit min-w-full justify-end gap-4.25">
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
