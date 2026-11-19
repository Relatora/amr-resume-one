"use client";

import type { SkillGroup } from "@/lib/types";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import SectionHeading from "@/components/ui/SectionHeading";
import WaveDivider from "@/components/ui/WaveDivider";
import { AddButton, EditButton, MoveButtons } from "@/components/ui/EditControls";
import SkillsBoard from "@/components/sections/skills/SkillsBoard";

// The section shell: heading, wave edges, the band, and the edit controls.
// The interactive board itself lives in skills/SkillsBoard.tsx.

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

  const editControls = (group: SkillGroup, gi: number) =>
    editMode ? (
      <span className="flex items-center gap-1">
        <MoveButtons
          onUp={() => move(group.id, -1)}
          onDown={() => move(group.id, 1)}
          canUp={gi > 0}
          canDown={gi < content.skills.length - 1}
        />
        <EditButton onClick={() => openEditor({ kind: "skills", id: group.id })} />
      </span>
    ) : null;

  return (
    <section id="skills" className="relative scroll-mt-20">
      <WaveDivider />
      <div className="bg-canvas-soft/60 py-24 [.light_&]:bg-white/70">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionHeading eyebrow="Toolbox" title="Skills" />
        </div>
        <SkillsBoard groups={content.skills} editControls={editControls} />
        {editMode && (
          <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
            <AddButton label="Add skill group" onClick={() => openEditor({ kind: "skills", id: null })} />
          </div>
        )}
      </div>
      <WaveDivider flip />
    </section>
  );
}
