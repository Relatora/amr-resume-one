"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  EducationEntry,
  ExperienceEntry,
  Personal,
  SkillGroup,
} from "@/lib/types";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor, type EditTarget } from "@/components/providers/EditorProvider";
import {
  DeleteButton,
  Field,
  StringListEditor,
  TextArea,
} from "@/components/editor/fields";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-canvas-soft shadow-2xl sm:max-w-md"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close editor"
            className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-sm text-ink-dim transition hover-veil"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
      </motion.aside>
    </>
  );
}

function SaveCancelRow({
  onSave,
  onCancel,
  deletable,
  onDelete,
}: {
  onSave: () => void;
  onCancel: () => void;
  deletable?: boolean;
  onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="cursor-pointer rounded-lg bg-gradient-to-r from-teal-400 to-violet-400 px-5 py-2 text-sm font-semibold text-on-accent transition hover:opacity-90 active:scale-[0.98]"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm text-ink-dim transition hover-veil"
        >
          Cancel
        </button>
      </div>
      {deletable && onDelete && (
        <DeleteButton
          onDelete={onDelete}
          confirming={confirming}
          setConfirming={setConfirming}
        />
      )}
    </div>
  );
}

function PersonalForm({ onClose }: { onClose: () => void }) {
  const { content, update } = useContent();
  const [draft, setDraft] = useState<Personal>(content.personal);
  const set = (k: keyof Personal) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <PanelShell title="Edit intro" onClose={onClose}>
      <Field label="Name" value={draft.name} onChange={set("name")} />
      <Field label="Title" value={draft.title} onChange={set("title")} />
      <Field label="Email" value={draft.email} onChange={set("email")} />
      <Field label="Resume PDF (file in /docs)" value={draft.resume} onChange={set("resume")} />
      <Field label="Location" value={draft.location} onChange={set("location")} />
      <TextArea label="Summary" value={draft.summary} onChange={set("summary")} rows={7} />
      <SaveCancelRow
        onSave={() => {
          update((c) => ({ ...c, personal: draft }));
          onClose();
        }}
        onCancel={onClose}
      />
    </PanelShell>
  );
}

function ExperienceForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { content, update } = useContent();
  const existing = content.experience.find((e) => e.id === id);
  const [draft, setDraft] = useState<ExperienceEntry>(
    existing ?? {
      id: newId(),
      title: "",
      org: "",
      start: "",
      end: "Present",
      type: "Full Time",
      summary: "",
      bullets: [""],
    }
  );
  const set = (k: "title" | "org" | "start" | "end" | "type" | "summary") =>
    (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    const clean = { ...draft, bullets: draft.bullets.filter((b) => b.trim()) };
    update((c) => ({
      ...c,
      experience: existing
        ? c.experience.map((e) => (e.id === clean.id ? clean : e))
        : [clean, ...c.experience],
    }));
    onClose();
  };

  return (
    <PanelShell title={existing ? "Edit experience" : "Add experience"} onClose={onClose}>
      <Field label="Job title" value={draft.title} onChange={set("title")} />
      <Field label="Organization" value={draft.org} onChange={set("org")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" value={draft.start} onChange={set("start")} placeholder="Apr 2021" />
        <Field label="End" value={draft.end} onChange={set("end")} placeholder="Present" />
      </div>
      <Field label="Employment type" value={draft.type} onChange={set("type")} placeholder="Full Time" />
      <TextArea label="Summary (optional)" value={draft.summary} onChange={set("summary")} rows={3} />
      <StringListEditor
        label="Bullets"
        items={draft.bullets}
        onChange={(bullets) => setDraft((d) => ({ ...d, bullets }))}
        multiline
        addLabel="Add bullet"
      />
      <SaveCancelRow
        onSave={save}
        onCancel={onClose}
        deletable={!!existing}
        onDelete={() => {
          update((c) => ({
            ...c,
            experience: c.experience.filter((e) => e.id !== draft.id),
          }));
          onClose();
        }}
      />
    </PanelShell>
  );
}

function SkillsForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { content, update } = useContent();
  const existing = content.skills.find((g) => g.id === id);
  const [draft, setDraft] = useState<SkillGroup>(
    existing ?? { id: newId(), category: "", items: [""] }
  );

  const save = () => {
    const clean = { ...draft, items: draft.items.filter((i) => i.trim()) };
    update((c) => ({
      ...c,
      skills: existing
        ? c.skills.map((g) => (g.id === clean.id ? clean : g))
        : [...c.skills, clean],
    }));
    onClose();
  };

  return (
    <PanelShell title={existing ? "Edit skill group" : "Add skill group"} onClose={onClose}>
      <Field
        label="Category"
        value={draft.category}
        onChange={(category) => setDraft((d) => ({ ...d, category }))}
      />
      <StringListEditor
        label="Skills"
        items={draft.items}
        onChange={(items) => setDraft((d) => ({ ...d, items }))}
        addLabel="Add skill"
      />
      <SaveCancelRow
        onSave={save}
        onCancel={onClose}
        deletable={!!existing}
        onDelete={() => {
          update((c) => ({
            ...c,
            skills: c.skills.filter((g) => g.id !== draft.id),
          }));
          onClose();
        }}
      />
    </PanelShell>
  );
}

function EducationForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { content, update } = useContent();
  const existing = content.education.find((e) => e.id === id);
  const [draft, setDraft] = useState<EducationEntry>(
    existing ?? {
      id: newId(),
      credential: "",
      institution: "",
      start: "",
      end: "",
      details: [""],
    }
  );
  const set = (k: "credential" | "institution" | "start" | "end") => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    const clean = { ...draft, details: draft.details.filter((d) => d.trim()) };
    update((c) => ({
      ...c,
      education: existing
        ? c.education.map((e) => (e.id === clean.id ? clean : e))
        : [...c.education, clean],
    }));
    onClose();
  };

  return (
    <PanelShell title={existing ? "Edit education" : "Add education"} onClose={onClose}>
      <Field label="Credential" value={draft.credential} onChange={set("credential")} />
      <Field label="Institution" value={draft.institution} onChange={set("institution")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" value={draft.start} onChange={set("start")} />
        <Field label="End" value={draft.end} onChange={set("end")} />
      </div>
      <StringListEditor
        label="Details"
        items={draft.details}
        onChange={(details) => setDraft((d) => ({ ...d, details }))}
        multiline
        addLabel="Add detail"
      />
      <SaveCancelRow
        onSave={save}
        onCancel={onClose}
        deletable={!!existing}
        onDelete={() => {
          update((c) => ({
            ...c,
            education: c.education.filter((e) => e.id !== draft.id),
          }));
          onClose();
        }}
      />
    </PanelShell>
  );
}

function FormFor({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  switch (target.kind) {
    case "personal":
      return <PersonalForm onClose={onClose} />;
    case "experience":
      return <ExperienceForm id={target.id} onClose={onClose} />;
    case "skills":
      return <SkillsForm id={target.id} onClose={onClose} />;
    case "education":
      return <EducationForm id={target.id} onClose={onClose} />;
  }
}

export default function EditPanel() {
  const { target, closeEditor } = useEditor();

  return (
    <AnimatePresence>
      {target && (
        <FormFor
          // Remount the form whenever the target changes so drafts reset.
          key={`${target.kind}-${"id" in target ? target.id : "self"}`}
          target={target}
          onClose={closeEditor}
        />
      )}
    </AnimatePresence>
  );
}
