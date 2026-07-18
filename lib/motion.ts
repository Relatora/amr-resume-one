import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 22 },
  },
};

export const ACCENTS = [
  {
    text: "text-teal-300",
    border: "border-teal-400/30",
    hoverBorder: "hover:border-teal-300/60",
    dot: "bg-teal-400",
    glow: "hover:shadow-teal-400/10",
  },
  {
    text: "text-violet-300",
    border: "border-violet-400/30",
    hoverBorder: "hover:border-violet-300/60",
    dot: "bg-violet-400",
    glow: "hover:shadow-violet-400/10",
  },
  {
    text: "text-amber-300",
    border: "border-amber-400/30",
    hoverBorder: "hover:border-amber-300/60",
    dot: "bg-amber-400",
    glow: "hover:shadow-amber-400/10",
  },
] as const;
