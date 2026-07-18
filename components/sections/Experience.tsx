"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ExperienceEntry } from "@/lib/types";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import SectionHeading from "@/components/ui/SectionHeading";
import { AddButton, EditButton, MoveButtons } from "@/components/ui/EditControls";
import { ACCENTS, fadeUp } from "@/lib/motion";

const PREVIEW_BULLETS = 3;

function ExperienceCard({
  entry,
  index,
  total,
}: {
  entry: ExperienceEntry;
  index: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { update } = useContent();
  const { editMode, openEditor } = useEditor();
  const accent = ACCENTS[index % ACCENTS.length];
  const hidden = entry.bullets.length - PREVIEW_BULLETS;

  const move = (dir: -1 | 1) =>
    update((c) => {
      const list = [...c.experience];
      const i = list.findIndex((e) => e.id === entry.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return c;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...c, experience: list };
    });

  return (
    <motion.article
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="relative pl-8 sm:pl-10"
    >
      {/* timeline dot + line */}
      <span
        className={`absolute left-0 top-2 h-3 w-3 rounded-full ${accent.dot} ring-4 ring-canvas`}
      />
      {index < total - 1 && (
        <span className="absolute left-[5px] top-6 bottom-[-2.5rem] w-0.5 bg-gradient-to-b from-line to-transparent" />
      )}

      <div
        className={`gradient-border group rounded-2xl p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${accent.glow} sm:p-6`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold sm:text-xl">
              {entry.title}
            </h3>
            <p className={`mt-0.5 text-sm font-semibold ${accent.text}`}>
              {entry.org}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-ink-dim">
              {entry.start} — {entry.end}
              <span className="ml-2 rounded-full border border-line px-2 py-0.5">
                {entry.type}
              </span>
            </p>
            {editMode && (
              <span className="flex items-center gap-1">
                <MoveButtons
                  onUp={() => move(-1)}
                  onDown={() => move(1)}
                  canUp={index > 0}
                  canDown={index < total - 1}
                />
                <EditButton
                  onClick={() => openEditor({ kind: "experience", id: entry.id })}
                />
              </span>
            )}
          </div>
        </div>

        {entry.summary && (
          <p className="mt-3 text-sm leading-relaxed text-ink-dim">
            {entry.summary}
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {entry.bullets.slice(0, PREVIEW_BULLETS).map((b, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-dim">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} />
              {b}
            </li>
          ))}
        </ul>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 space-y-2 overflow-hidden"
            >
              {entry.bullets.slice(PREVIEW_BULLETS).map((b, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-dim">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} />
                  {b}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {hidden > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className={`mt-4 cursor-pointer text-xs font-semibold ${accent.text} transition hover:opacity-80`}
          >
            {expanded ? "Show less ↑" : `Show ${hidden} more ↓`}
          </button>
        )}
      </div>
    </motion.article>
  );
}

export default function Experience() {
  const { content } = useContent();
  const { editMode, openEditor } = useEditor();

  return (
    <section id="experience" className="relative mx-auto max-w-5xl scroll-mt-20 px-4 py-24 sm:px-6">
      <SectionHeading eyebrow="Career" title="Experience" />
      <div className="space-y-10">
        {content.experience.map((entry, i) => (
          <ExperienceCard
            key={entry.id}
            entry={entry}
            index={i}
            total={content.experience.length}
          />
        ))}
      </div>
      {editMode && (
        <div className="mt-10 pl-8 sm:pl-10">
          <AddButton
            label="Add experience"
            onClick={() => openEditor({ kind: "experience", id: null })}
          />
        </div>
      )}
    </section>
  );
}
