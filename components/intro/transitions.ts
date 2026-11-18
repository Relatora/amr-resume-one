import type { MotionProps } from "framer-motion";

// The cuts between projects in the intro spot. Each slide enters with the cut
// at its index (wrapping), so adding a project to content.json picks up the
// next style automatically. A cut is just three Framer Motion targets, so a
// new style is one more entry here and needs no change to the component.

export interface Cut {
  name: string;
  initial: MotionProps["initial"];
  animate: MotionProps["animate"];
  exit: MotionProps["exit"];
  // Slice the incoming screenshot into sheared bands for a few frames.
  glitch?: boolean;
}

// Fast out, long settle: reads as a hard hit that lands softly.
export const EXPO = [0.16, 1, 0.3, 1] as const;

export const CUTS: Cut[] = [
  {
    // Punch in from oversized and out of focus.
    name: "zoom",
    initial: { opacity: 0, scale: 1.3, filter: "blur(16px)" },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: EXPO },
    },
    exit: {
      opacity: 0,
      scale: 0.86,
      filter: "blur(10px)",
      transition: { duration: 0.22, ease: "easeIn" },
    },
  },
  {
    // A diagonal blade sweeps right to left. The four polygon points move
    // independently, and every point ends past the edge so nothing is clipped
    // once the wipe lands.
    name: "wipe",
    initial: { clipPath: "polygon(120% 0%, 140% 0%, 120% 100%, 100% 100%)" },
    animate: {
      clipPath: "polygon(-40% 0%, 140% 0%, 120% 100%, -60% 100%)",
      transition: { duration: 0.55, ease: EXPO },
    },
    exit: { opacity: 0, x: "-12%", transition: { duration: 0.22, ease: "easeIn" } },
  },
  {
    // Jitters into place while the screenshot tears into bands.
    name: "glitch",
    glitch: true,
    initial: { opacity: 0, x: -40, skewX: 14 },
    animate: {
      opacity: [0, 1, 1, 1],
      x: [-40, 24, -10, 0],
      skewX: [14, -8, 3, 0],
      transition: { duration: 0.4, times: [0, 0.35, 0.7, 1], ease: "linear" },
    },
    exit: { opacity: 0, x: 50, skewX: -12, transition: { duration: 0.2 } },
  },
  {
    // An iris opens from the frame's centre. circle() percentages are
    // relative to the viewport diagonal, so 150% always clears the corners.
    name: "iris",
    initial: { clipPath: "circle(0% at 50% 45%)" },
    animate: {
      clipPath: "circle(150% at 50% 45%)",
      transition: { duration: 0.6, ease: EXPO },
    },
    exit: {
      opacity: 0,
      scale: 1.08,
      filter: "blur(8px)",
      transition: { duration: 0.22 },
    },
  },
];

// Reduced motion keeps the pacing but trades every cut for a quick
// crossfade: no flashes, tears, zooms or wipes.
export const FADE: Cut = {
  name: "fade",
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// One accent per slide, cycling. The site's teal, violet and amber, plus a
// sky blue in place of the site's rose: a saturated red flash is the riskiest
// colour for photosensitive viewers, so it never appears in a flash frame.
export const ACCENTS = ["#2dd4bf", "#b1a0fc", "#fbbf24", "#60a5fa"] as const;

export const accentAt = (i: number): string => ACCENTS[i % ACCENTS.length];
