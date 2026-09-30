/** The section hues. Violet is deliberately absent; vermilion is reserved for errors and never a section hue. */
export type Hue =
  | "yellow"
  | "orange"
  | "grass"
  | "teal"
  | "blue"
  | "sienna"
  | "ink";

interface HueStyle {
  /** The colour token behind the tab, used on a division's panels. */
  cssVar: string;
}

export const HUES: Record<Hue, HueStyle> = {
  yellow: { cssVar: "--gl-tag" },
  orange: { cssVar: "--gl-tab-orange" },
  grass: { cssVar: "--gl-tab-grass" },
  teal: { cssVar: "--gl-tab-teal" },
  blue: { cssVar: "--gl-tab-blue" },
  sienna: { cssVar: "--gl-tab-sienna" },
  ink: { cssVar: "--gl-text" },
};
