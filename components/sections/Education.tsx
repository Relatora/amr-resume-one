"use client";

import { motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import SectionHeading from "@/components/ui/SectionHeading";
import { AddButton, EditButton, MoveButtons } from "@/components/ui/EditControls";
import { ACCENTS, fadeUp } from "@/lib/motion";

export default function Education() {
  const { content, update } = useContent();
  const { editMode, openEditor } = useEditor();

  const move = (id: string, dir: -1 | 1) =>
    update((c) => {
      const list = [...c.education];
      const i = list.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return c;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...c, education: list };
    });

  return (
    <section id="education" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-24 sm:px-6">
      <SectionHeading eyebrow="Learning" title="Education" />
      <div className="grid gap-6 md:grid-cols-3">
        {content.education.map((entry, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          return (
            <motion.div
              key={entry.id}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08 }}
              className={`gradient-border flex flex-col rounded-2xl p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 ${accent.glow}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-xs text-ink-dim">
                  {entry.start} — {entry.end}
                </p>
                {editMode && (
                  <span className="flex items-center gap-1">
                    <MoveButtons
                      onUp={() => move(entry.id, -1)}
                      onDown={() => move(entry.id, 1)}
                      canUp={i > 0}
                      canDown={i < content.education.length - 1}
                    />
                    <EditButton
                      onClick={() => openEditor({ kind: "education", id: entry.id })}
                    />
                  </span>
                )}
              </div>
              <h3 className="font-display mt-2 text-base font-bold">
                {entry.credential}
              </h3>
              <p className={`mt-1 text-sm font-semibold ${accent.text}`}>
                {entry.institution}
              </p>
              <ul className="mt-3 space-y-2">
                {entry.details.map((d, di) => (
                  <li key={di} className="flex gap-2 text-xs leading-relaxed text-ink-dim">
                    <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${accent.dot}`} />
                    {d}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
      {editMode && (
        <div className="mt-8">
          <AddButton
            label="Add education"
            onClick={() => openEditor({ kind: "education", id: null })}
          />
        </div>
      )}
    </section>
  );
}
