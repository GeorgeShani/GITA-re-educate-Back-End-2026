import type { CSSProperties } from "react";

export type Dance = "hype" | "floss" | "best-mates" | "robot" | "dab";

const ALL_DANCES: Dance[] = ["hype", "floss", "best-mates", "robot", "dab"];

export function pickRandomDance(): Dance {
  return ALL_DANCES[Math.floor(Math.random() * ALL_DANCES.length)]!;
}

interface Clip {
  body: string;
  arm: string;
  leg: string;
  antenna: string;
  /** true: left/right arms rotate with opposite sign (mirrored). false: same sign (parallel). */
  armMirror: boolean;
  /** animation-delay applied to the right arm only ("0s" keeps both arms in sync). */
  armPhase: string;
  legMirror: boolean;
  legPhase: string;
  /** Per-side overrides for genuinely asymmetric arm poses (e.g. Dab), where
   *  the two arms need entirely different keyframes rather than a mirrored
   *  sign of the same one. Falls back to `arm` on either side when unset. */
  armLeftClass?: string;
  armRightClass?: string;
  /** When true, the left arm paints AFTER the body instead of before it, so
   *  it renders on top of the face rather than being hidden behind the torso
   *  — needed for Dab, where that arm sweeps across to cover the face. */
  armLeftInFront?: boolean;
}

const CLIPS: Record<Dance, Clip> = {
  hype: {
    body: "animate-hype-body",
    arm: "animate-hype-arm",
    leg: "animate-hype-leg",
    antenna: "animate-hype-antenna",
    armMirror: true,
    armPhase: "-0.275s",
    legMirror: true,
    legPhase: "-0.275s",
  },
  floss: {
    body: "animate-floss-body",
    arm: "animate-floss-arm",
    leg: "animate-floss-leg",
    antenna: "animate-floss-antenna",
    armMirror: false,
    armPhase: "0s",
    legMirror: false,
    legPhase: "0s",
  },
  "best-mates": {
    body: "animate-mates-body",
    arm: "animate-mates-arm",
    leg: "animate-mates-leg",
    antenna: "animate-mates-antenna",
    armMirror: true,
    armPhase: "-0.35s",
    legMirror: true,
    legPhase: "-0.35s",
  },
  robot: {
    body: "animate-robot-body",
    arm: "animate-robot-arm",
    leg: "animate-robot-leg",
    antenna: "animate-robot-antenna",
    armMirror: true,
    armPhase: "-0.45s",
    legMirror: true,
    legPhase: "-0.45s",
  },
  dab: {
    body: "animate-dab-body",
    arm: "animate-dab-arm-raise",
    // Left arm sweeps across to cover the face (painted in front of the
    // body — see armLeftInFront); right arm raises up and out.
    armLeftClass: "animate-dab-arm-cover",
    armRightClass: "animate-dab-arm-raise",
    armLeftInFront: true,
    leg: "animate-dab-leg",
    antenna: "animate-dab-antenna",
    armMirror: false,
    armPhase: "0s",
    legMirror: false,
    legPhase: "0s",
  },
};

const GREEN = "var(--color-term-green)";
const PANEL = "var(--color-term-panel)";

/** Base style shared by every animated rig part: pivot in viewBox coords + GPU hint. */
function part(originX: number, originY: number, dir?: number, delay?: string): CSSProperties {
  return {
    transformBox: "view-box",
    transformOrigin: `${originX}px ${originY}px`,
    willChange: "transform",
    ...(dir !== undefined ? ({ "--dir": dir } as CSSProperties) : {}),
    ...(delay ? { animationDelay: delay } : {}),
  };
}

interface MascotDancerProps {
  dance: Dance;
  className?: string;
}

/**
 * The app's logo brought to life: a terminal-headed critter (its face is the
 * `>_` prompt) that performs one of six dance clips. One SVG rig, swappable
 * animation clips — see the `@keyframes` in index.css.
 *
 * By default all four limbs are painted BEFORE the body, and each limb's
 * pivot sits well inside the body's silhouette (not at its edge). That means
 * the body's opaque fill always covers the limb's root, at every rotation
 * angle, so arms/legs read as emerging from behind the head/torso panel
 * instead of floating loose beside it. Dab's left arm is the one exception
 * (see armLeftInFront) — it needs to sit ON TOP of the face, not behind it.
 */
export function MascotDancer({ dance, className = "h-32 w-32" }: MascotDancerProps) {
  const clip = CLIPS[dance];
  const armLeftDir = clip.armMirror ? -1 : 1;
  const legLeftDir = clip.legMirror ? -1 : 1;
  const armLeftClass = clip.armLeftClass ?? clip.arm;
  const armRightClass = clip.armRightClass ?? clip.arm;

  // The default hidden-root pivot (37,40) sits deep inside the body, which
  // is exactly the problem for a face-covering arm: painting it in front
  // still leaves it floating as a self-contained diagonal inside the panel,
  // never touching the body's outline, so it reads as detached rather than
  // attached at the shoulder. This pivot sits right at the body's left
  // edge instead, so the stroke visibly crosses that edge on its way to
  // the face — a continuous line from shoulder to face, not a stray slash.
  const leftArm = clip.armLeftInFront ? (
    <g className={armLeftClass} style={part(30, 44, armLeftDir)}>
      <path d="M30 44 L22 58" stroke={GREEN} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </g>
  ) : (
    <g className={armLeftClass} style={part(37, 40, armLeftDir)}>
      <path d="M37 40 L28 56" stroke={GREEN} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Dancing terminal mascot"
      style={{ filter: "drop-shadow(0 0 6px rgba(57, 255, 20, 0.45))" }}
    >
      {/* legs — pivot well inside the body so the top of each leg tucks under it */}
      <g className={clip.leg} style={part(43, 57, legLeftDir)}>
        <path d="M43 57 L41 79" stroke={GREEN} strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>
      <g className={clip.leg} style={part(57, 57, 1, clip.legPhase)}>
        <path d="M57 57 L59 79" stroke={GREEN} strokeWidth={4} strokeLinecap="round" fill="none" />
      </g>

      {/* arms — same idea: pivot inset from the shoulder edge, not on it */}
      {!clip.armLeftInFront && leftArm}
      <g className={armRightClass} style={part(63, 40, 1, clip.armPhase)}>
        <path d="M63 40 L72 56" stroke={GREEN} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      </g>

      {/* body + face — painted last, on top of every limb's root. The antenna
          is nested INSIDE this group (not a sibling) so it inherits the
          body's own translate/scale — e.g. Gangnam Style's squat-and-pop —
          instead of staying pinned in place while the head bounces under it.
          Its own rotation wobble still applies on top, since transform-box:
          view-box keeps its transform-origin in the SVG's fixed coordinate
          space regardless of the parent's transform. */}
      <g className={clip.body} style={part(50, 62)}>
        <g className={clip.antenna} style={part(50, 31)}>
          <path d="M50 31 L50 21" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" fill="none" />
          <circle cx="50" cy="18.5" r="2.4" fill={GREEN} />
        </g>
        <rect
          x="33"
          y="31"
          width="34"
          height="31"
          rx="8"
          fill={PANEL}
          stroke={GREEN}
          strokeWidth={2.5}
        />
        {/* face: >_ prompt */}
        <path
          d="M43 42 L49 47 L43 52"
          stroke={GREEN}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M53 51 L60 51" stroke={GREEN} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </g>

      {/* Dab only: the covering arm paints here, on top of the body, so it
          visibly crosses the face instead of being hidden behind it. */}
      {clip.armLeftInFront && leftArm}
    </svg>
  );
}
