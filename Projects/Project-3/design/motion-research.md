# Motion research: what modern sites animate, and what fits Gridline

Requirement (PRODUCT.md, Brand Commitments): animations and transitions are part of the product; a static site reads as
unfinished. This note is the survey that feeds the motion decisions in DESIGN.md. It records options, not commitments.

Where impeccable's default advice ("one authored moment, not scattered effects") pulls against the owner's requirement, the
requirement wins. What stays from that advice is the discipline: every animation explains a state, a relationship or an
arrival, and none blocks the task.

## 1. What modern sites animate

| Family | What it looks like | Where it earns its place |
|---|---|---|
| Entrance and reveal | Content fades and rises into place as it scrolls into view; lists stagger in | Marketing sections, lists that load |
| Hero sequence | Headline lines reveal through a mask; a product demo plays itself; numbers count up | The first viewport of the landing page |
| Scroll-linked | A progress bar fills with the page; the header changes state; a pinned scene advances as you scroll (scrollytelling) | Long marketing pages, the compare and features pages |
| Micro-interactions | Button press, arrow nudge, underline draw, toggle slide, copy-confirm tick, focus ring | Every control |
| Route transitions | A card morphs into its detail page; pages slide forward and back; content crossfades in place | Files list to file detail, tabs |
| Layout animation | An accordion opens, a list reorders, a row is inserted and its neighbours slide apart | Tables, filters, settings |
| Overlays | Menu drops, dialog scales in, sheet slides, toast arrives and leaves | Menus, dialogs, toasts |
| Loading | Skeletons, progress, content that streams in and replaces its placeholder | Every fetch |
| Live data | A status pulses, a meter fills, a chart draws itself, a row flashes when it changes | Realtime report status, quota, analytics |
| Text | A variable font changes weight or width, text types or decodes | Headlines, hover states |
| Ambient and 3D | Marquees, tilting cards, parallax, WebGL or shader backgrounds, Lottie/Rive illustrations | Rarely justified for a data product |

## 2. The platform, and what each piece costs

- **CSS transitions and keyframes.** The default. Composite-only properties (`transform`, `opacity`, `filter`) skip layout
  and paint and stay smooth.
- **Scroll-driven animations** (`animation-timeline: scroll()` / `view()`, `animation-range`). Reveals, progress bars and
  parallax with no JavaScript and no scroll listeners. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations)
  lists good support in Chrome and Edge and limited support in Firefox and Safari, so each use needs an
  `@supports` fallback: content stays visible and simply does not animate.
- **View Transitions API.** Snapshot-based animation between two states, for a single page and across documents.
  `view-transition-name` gives a shared-element morph.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API).
- **React's `<ViewTransition>` in Next 16.** Declarative: give the same `name` to the thumbnail and the hero and the browser
  morphs one into the other; route navigations are transitions, so it activates automatically. Patterns in Next's own guide:
  shared-element morph, Suspense reveal (skeleton exits, content enters), directional slides, same-route crossfade. Without
  browser support the app works and the transition does not animate. Source: `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.
  Check that `import { ViewTransition } from "react"` type-checks against the installed React types before relying on it.
- **Web Animations API.** For interruptible, dynamic, sequenced motion that CSS cannot express.
- **A motion library** (Motion, formerly Framer Motion). Worth adding only for what the platform does badly: shared layout
  animation inside one page (reordering, inserting and removing rows), gestures, spring physics. GSAP with ScrollTrigger is the
  heavier alternative for long pinned sequences. Lottie and Rive are for authored illustration, which this product does not need.

## 3. Rules that make motion feel expensive, not busy

- Animate `transform`, `opacity` and `filter`. Avoid `width`, `height`, `top`, `left` and margins; use FLIP or the
  `grid-template-rows: 0fr → 1fr` technique for accordions.
- Timing: 100-150 ms for feedback, 150-300 ms for state changes, 300-500 ms for overlays and route transitions, 500-800 ms only
  for an authored entrance. Exits are faster than entrances. Use deceleration (`cubic-bezier(0.16, 1, 0.3, 1)`, already the
  `--ease-out` token). No bounce by reflex.
- Content is visible by default. A script that fails must not leave a blank page.
- Loops pause when offscreen or hidden. Nothing autoplays with sound.
- `prefers-reduced-motion`: remove movement, keep opacity, colour and state change. Confirmation feedback must still be legible.
- Stagger only what is a list, and cap the total delay so the last item does not arrive late.
- Measure on a mid-range phone, not on the development machine.

## 4. A motion vocabulary in the Gridline world

Everything below comes from the receiving dock. Each item names its job.

| Motion | Behaviour | Job | Where |
|---|---|---|---|
| Print | A line reveals left to right, like a label printer (`gl-print`, exists) | Shows a check being made | Hero label, report rows appearing |
| Stamp | PASS or HOLD lands in two frames, pressed slightly large then set (`gl-stamp`, exists) | Announces a result | Report finishing, rule results |
| Scan | A thin scan line sweeps a file card while it is being inspected | The one "live" state | A profiling file, the only place hi-vis yellow moves |
| Conveyor | New rows slide in from the side and their neighbours make room | Arrival of an upload or a realtime update | Files list, notifications |
| Tag swing | The inspection tag swings a few degrees on its string when it enters or is hovered | Personality on the brand object | Footer tag, empty states |
| Tick | Numbers count to their value with tabular figures so nothing jitters | Quota, bill, score | Dashboard, billing |
| Fill | Meters fill and charts draw from zero when first shown | Reading a quantity | Quota meter, analytics |
| Morph | A file row becomes its detail header (shared element) | Continuity across routes | Files list to file detail |
| Slide | Forward navigation slides one way, back the other | Direction | Versions, compare |
| Reveal | Sections rise and fade into place as they scroll in, headline lines through a mask | Marketing pacing | Landing, features, compare |
| Progress | A hairline at the top of the page fills with scroll | Orientation on long pages | Compare, docs |
| Press | Buttons sink 1px and darken on press; arrows nudge on hover; links draw their underline | Feedback | Every control |
| Width | Archivo's width axis (72 to 112) widens on hover for a headline word | A move only this typeface can make | One or two display moments, not nav (it would reflow) |

## 5. Recommended approach for the build

1. **CSS-first.** Tokens for duration and easing already exist; add the keyframes above. Reveals and the progress bar use
   scroll-driven CSS with an `@supports` fallback and a small intersection-observer fallback for Safari and Firefox.
2. **React `<ViewTransition>`** for route morphs, Suspense reveals and directional slides, once the type check passes.
3. **Add the `motion` package** only if layout animation (reordering, inserting rows) is needed and CSS cannot express it.
4. **No** parallax, animated gradients, cursor effects, 3D tilt or shader backgrounds: they are the "AI-slop" motion, and
   they say nothing about spreadsheets.
5. Every animation gets a reduced-motion path in the same change that introduces it.

## Sources

- MDN, CSS scroll-driven animations: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations
- MDN, View Transition API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Next.js 16 docs, Designing view transitions (bundled with the installed package)
- Impeccable animate reference (timing table, easing, accessibility rules)
