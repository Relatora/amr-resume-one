"use client";

import { motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import { useIntro } from "@/components/intro/IntroProvider";

// Header chip that replays the intro. Its glyph is the deck itself: three
// cards that fan out on hover. A slowly turning gradient ring marks it as
// something to play, and it pulses whenever the intro's cards land in it.
// The id is what the intro's outro measures to aim its cards.

const CARDS = [
  { rest: { rotate: -10, x: -2.5 }, fan: { rotate: -22, x: -5, y: 0.5 }, fill: "#2dd4bf" },
  { rest: { rotate: 0, x: 0 }, fan: { rotate: 0, x: 0, y: -1.5 }, fill: "#b1a0fc" },
  { rest: { rotate: 10, x: 2.5 }, fan: { rotate: 22, x: 5, y: 0.5 }, fill: "#fbbf24" },
];

export default function ReplayButton() {
  const { play, landings } = useIntro();
  const { content } = useContent();
  const { editMode, openEditor } = useEditor();

  if (!content.projects?.length && !editMode) return null;

  return (
    <span className="flex items-center gap-1.5">
      <motion.button
        id="intro-replay"
        onClick={play}
        aria-label="Replay project highlights"
        title="Replay project highlights"
        initial="rest"
        animate="rest"
        whileHover="fan"
        whileFocus="fan"
        whileTap={{ scale: 0.88 }}
        className="replay-ring relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
      >
        {/* One burst per landing, keyed so each new landing restarts it. */}
        {landings > 0 && (
          <motion.span
            key={landings}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-teal-300"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}
        <svg aria-hidden viewBox="-8 -8 16 16" className="relative h-4 w-4 overflow-visible">
          {CARDS.map((c, i) => (
            <motion.rect
              key={i}
              x={-3}
              y={-4.5}
              width={6}
              height={9}
              rx={1.2}
              fill={c.fill}
              stroke="var(--color-canvas)"
              strokeWidth={0.8}
              style={{ originX: "50%", originY: "100%" }}
              variants={{ rest: c.rest, fan: c.fan }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
            />
          ))}
        </svg>
      </motion.button>
      {editMode && (
        <button
          onClick={() => openEditor({ kind: "projects" })}
          aria-label="Edit projects"
          title="Edit projects"
          className="cursor-pointer rounded-md border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-xs text-accent-violet transition hover:bg-violet-400/20"
        >
          ✎
        </button>
      )}
    </span>
  );
}
