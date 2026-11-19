"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "framer-motion";
import type { SkillGroup } from "@/lib/types";
import { accentAt } from "@/components/intro/transitions";
import { useHydrated } from "@/lib/useHydrated";

// The interactive skill board. Every skill sits on one board; a pill bar
// picks a group, whose chips glide to the front in its accent colour while
// the rest fade back. When the board first scrolls into view it steps
// through a few groups by itself to show what it does, and hands over the
// moment the visitor picks one.

// The groups, and a renderer for a group's edit controls (move up/down,
// edit), which returns null outside edit mode.
export interface SkillsBoardProps {
  groups: SkillGroup[];
  editControls: (group: SkillGroup, index: number) => React.ReactNode;
}

const ALL = "all";
const DEMO_STEPS = 3;
const DEMO_MS = 1600;

export default function SkillsBoard({ groups, editControls }: SkillsBoardProps) {
  // false until hydrated, so the first render matches the server's HTML
  const hydrated = useHydrated();
  const prefersReduced = useReducedMotion() ?? false;
  const reduce = hydrated && prefersReduced;
  const [selected, setSelected] = useState<string>(ALL);
  const board = useRef<HTMLDivElement>(null);
  const inView = useInView(board, { once: true, margin: "-25% 0px" });
  const touched = useRef(false);

  // The self-running demo: a few groups, then back to everything.
  useEffect(() => {
    if (!inView || reduce || groups.length === 0) return;
    const steps = [...groups.slice(0, DEMO_STEPS).map((g) => g.id), ALL];
    let i = 0;
    const id = setInterval(() => {
      if (touched.current || i >= steps.length) return clearInterval(id);
      setSelected(steps[i++]);
    }, DEMO_MS);
    return () => clearInterval(id);
  }, [inView, reduce, groups]);

  const pick = (id: string) => {
    touched.current = true;
    setSelected(id);
  };

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const activeIndex = groups.findIndex((g) => g.id === selected);
  const active = activeIndex >= 0 ? groups[activeIndex] : null;

  // Chips in board order: the selected group's first, then the rest in
  // their usual order, so a change of selection visibly gathers them.
  const chips = groups.flatMap((g, gi) => g.items.map((item) => ({ key: `${g.id}:${item}`, item, gi, id: g.id })));
  const ordered = active ? [...chips.filter((c) => c.id === active.id), ...chips.filter((c) => c.id !== active.id)] : chips;

  // Arrow keys move along the pill bar.
  const pills = [ALL, ...groups.map((g) => g.id)];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = pills.indexOf(selected);
    const next = pills[(i + (e.key === "ArrowRight" ? 1 : pills.length - 1)) % pills.length];
    pick(next);
    document.getElementById(`skill-pill-${next}`)?.focus();
  };

  return (
    <div ref={board} className="mx-auto max-w-5xl px-4 sm:px-6">
      <LayoutGroup>
        <div role="toolbar" aria-label="Filter skills by area" onKeyDown={onKey} className="flex flex-wrap gap-2">
          {pills.map((id) => {
            const gi = groups.findIndex((g) => g.id === id);
            const label = gi >= 0 ? groups[gi].category : "All";
            const count = gi >= 0 ? groups[gi].items.length : total;
            const on = selected === id;
            const accent = gi >= 0 ? accentAt(gi) : "#94a3b8";
            return (
              <button
                key={id}
                id={`skill-pill-${id}`}
                onClick={() => pick(id)}
                aria-pressed={on}
                className={`relative cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  on ? "border-transparent text-on-accent" : "border-line text-ink-dim hover:text-ink"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="skill-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ background: accent }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative">
                  {label} <span className={on ? "opacity-70" : "opacity-50"}>{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h3
              key={selected}
              className="text-[clamp(2.4rem,6vw,4.5rem)] leading-none"
              style={{
                fontFamily: "var(--font-anton)",
                color: active ? accentAt(activeIndex) : undefined,
              }}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {active ? active.category : "Everything I work with"}
            </motion.h3>
          </AnimatePresence>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-dim">
              {active ? `${active.items.length} skills` : `${total} skills across ${groups.length} areas`}
            </span>
            {active && editControls(active, activeIndex)}
          </div>
        </div>

        <motion.ul layout={!reduce} className="mt-6 flex flex-wrap gap-2.5">
          {ordered.map((c) => {
            const lit = !active || c.id === active.id;
            const accent = accentAt(c.gi);
            return (
              <motion.li
                key={c.key}
                layout={!reduce}
                animate={{ opacity: lit ? 1 : 0.22, scale: lit ? 1 : 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                whileHover={lit && !reduce ? { y: -3 } : undefined}
                className="rounded-full border px-3.5 py-1.5 text-sm text-ink"
                style={{
                  borderColor: `color-mix(in oklab, ${accent} ${lit ? 55 : 25}%, transparent)`,
                  background: `color-mix(in oklab, ${accent} ${lit && active ? 16 : 6}%, transparent)`,
                  boxShadow: lit && active ? `0 8px 24px -14px ${accent}` : undefined,
                }}
              >
                {c.item}
              </motion.li>
            );
          })}
        </motion.ul>
      </LayoutGroup>
    </div>
  );
}
