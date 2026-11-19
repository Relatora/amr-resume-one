"use client";

import { useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";

// Tilts a card toward the cursor, with a glare that follows it. The pointer
// position over the card (0..1 on each axis) is eased by a spring, so the
// tilt follows smoothly instead of jittering. Mouse only: touch and pen get
// a still card. Spread `handlers` on the card, and put `style` on it when
// `enabled`; `glare` is a background for an overlay inside the card.
export function useTilt({
  accent,
  enabled,
  maxX = 4,
  maxY = 5,
  glareSize = 600,
}: {
  accent: string;
  enabled: boolean;
  maxX?: number;
  maxY?: number;
  glareSize?: number;
}) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 180, damping: 20 });
  const sy = useSpring(py, { stiffness: 180, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-maxY, maxY]);
  const rotateX = useTransform(sy, [0, 1], [maxX, -maxX]);
  const glareX = useTransform(sx, (v) => `${v * 100}%`);
  const glareY = useTransform(sy, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(${glareSize}px circle at ${glareX} ${glareY}, color-mix(in oklab, ${accent} 22%, transparent), transparent 60%)`;

  const handlers = {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.pointerType !== "mouse") return;
      const r = e.currentTarget.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width);
      py.set((e.clientY - r.top) / r.height);
    },
    onPointerLeave: () => {
      px.set(0.5);
      py.set(0.5);
    },
  };

  return { handlers, style: enabled ? { rotateX, rotateY } : undefined, glare };
}
