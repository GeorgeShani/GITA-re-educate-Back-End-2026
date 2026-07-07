import { DURATION, EASE_STANDARD } from "@/animations/tokens";

// Subtle press feedback for buttons/tags — spread directly onto a motion.* element.
export const tapScale = {
  whileTap: { scale: 0.98 },
  transition: { duration: DURATION.button, ease: EASE_STANDARD },
};

// Fade + soft rise for small inline reveals (error hints, validation messages).
export const fadeRise = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DURATION.micro, ease: EASE_STANDARD },
};

// Soft scale+fade pop for small toggled indicators (checkmarks, radio dots).
export const popIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: DURATION.micro, ease: EASE_STANDARD },
};

// Dialog backdrop fade.
export const dialogBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.dialog, ease: EASE_STANDARD },
};

// Dialog panel entrance/exit — soft rise + scale, no bounce.
export const dialogPanel = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
  transition: { duration: DURATION.dialog, ease: EASE_STANDARD },
};

// Step-to-step content swap inside a wizard — forward-only horizontal drift,
// faster than the one-time dialog open since it repeats per step.
export const stepTransition = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: DURATION.card, ease: EASE_STANDARD },
};

// Popover open/close (Navbar's profile menu) — small soft scale+fade, using
// DURATION.card like stepTransition since it toggles frequently rather than
// once per session like the dialog.
export const popoverPanel = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: DURATION.card, ease: EASE_STANDARD },
};

// Fade + rise the first time a section scrolls into view. Deliberately slow
// and smooth (0.9s ease-out) so sections glide up rather than snap — longer
// than the shared DURATION tokens, which are tuned for frequent UI feedback
// (buttons, dialogs) rather than one-time scroll reveals. `once: true` plays it
// a single time; `amount: 0.2` fires at 20% visible so sections below the fold
// on the tall mobile Home animate as you reach them. Spread onto a motion.*
// element in place of initial/animate.
export const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.9, ease: EASE_STANDARD },
};

// Sequential reveal for Home page sections. Parent container uses initial="hidden"
// whileInView="visible" variants={homeSections}; each child uses variants={homeSection}.
// Children appear one after another with staggered delays.
export const homeSections = {
  hidden: {},
  visible: { transition: { delayChildren: 0.15, staggerChildren: 0.25 } },
};

export const homeSection = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE_STANDARD } },
};

// Subtle sequential reveal for text elements inside a card/section.
// Nest inside a section-level stagger container (e.g. homeSection) to have
// text elements appear one-by-one after the section itself slides in.
export const textStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export const textReveal = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_STANDARD } },
};

// Mood Trends chart bar cascade, also viewport-triggered. `barsStagger` goes on
// the bars row (initial="hidden" whileInView="visible") and reveals its
// children left-to-right; each bar column uses `barReveal` to grow up from the
// axis baseline (pair with style={{ transformOrigin: "bottom" }}). Slow, evenly
// spaced growth (0.7s per bar, 0.12s apart) so the chart fills in gracefully.
export const barsStagger = {
  hidden: {},
  visible: { transition: { delayChildren: 0.15, staggerChildren: 0.12 } },
};

export const barReveal = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: { scaleY: 1, opacity: 1, transition: { duration: 0.7, ease: EASE_STANDARD } },
};
