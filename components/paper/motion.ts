"use client";

import { useScroll, useSpring } from "framer-motion";

// Scroll helpers shared by the paper scenery and the sky keywords.

// Sprung scroll values: the scenery eases toward the real scroll position
// rather than snapping to it. Soft enough to glide, firm enough that it
// never feels like it is lagging behind the text.
const SPRING = { stiffness: 110, damping: 26, mass: 0.5 };
export function useSmoothScroll() {
  const { scrollY, scrollYProgress } = useScroll();
  return {
    scrollY: useSpring(scrollY, SPRING),
    progress: useSpring(scrollYProgress, SPRING),
  };
}

// Wraps a scroll-driven position into a loop, so pieces that scroll off the
// top come back in from the bottom and the sky never runs out.
export const wrap = (v: number, span: number) => ((v % span) + span) % span;
