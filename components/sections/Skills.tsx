"use client";

import { motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import SectionHeading from "@/components/ui/SectionHeading";
import { AddButton, EditButton, MoveButtons } from "@/components/ui/EditControls";
import { ACCENTS, fadeUp, popIn, stagger } from "@/lib/motion";

export default function Skills() {
  const { content, update } = useContent();
  const { editMode, openEditor } = useEditor();

  const move = (id: string, dir: -1 | 1) =>
    update((c) => {
      const list = [...c.skills];
      const i = list.findIndex((g) => g.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return c;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...c, skills: list };
    });

  return (
    <section id="skills" className="relative scroll-mt-20 bg-base-soft py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeading eyebrow="Toolbox" title="Skills" />
        <div className="grid gap-6 sm:grid-cols-2">
          {content.skills.map((group, gi) => {
            const accent = ACCENTS[gi % ACCENTS.length];
            return (
              <motion.div
                key={group.id}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                className={`gradient-border rounded-2xl p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 ${accent.glow}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`font-display text-base font-bold ${accent.text}`}>
                    {group.category}
                  </h3>
                  {editMode && (
                    <span className="flex items-center gap-1">
                      <MoveButtons
                        onUp={() => move(group.id, -1)}
                        onDown={() => move(group.id, 1)}
                        canUp={gi > 0}
                        canDown={gi < content.skills.length - 1}
                      />
                      <EditButton
                        onClick={() => openEditor({ kind: "skills", id: group.id })}
                      />
                    </span>
                  )}
                </div>
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  className="mt-4 flex flex-wrap gap-2"
                >
                  {group.items.map((item) => (
                    <motion.span
                      key={item}
                      variants={popIn}
                      className={`rounded-full border ${accent.border} ${accent.hoverBorder} bg-white/[0.03] px-3 py-1 text-xs text-ink transition hover:bg-white/[0.07]`}
                    >
                      {item}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
        {editMode && (
          <div className="mt-8">
            <AddButton
              label="Add skill group"
              onClick={() => openEditor({ kind: "skills", id: null })}
            />
          </div>
        )}
      </div>
    </section>
  );
}
