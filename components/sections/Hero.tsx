"use client";

import { motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import { EditButton } from "@/components/ui/EditControls";
import { fadeUp, stagger } from "@/lib/motion";

export default function Hero() {
  const { content } = useContent();
  const { editMode, openEditor } = useEditor();
  const { personal } = content;

  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden pt-14"
    >
      {/* animated background */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-teal-500/15 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute top-1/4 -right-32 h-[28rem] w-[28rem] rounded-full bg-violet-500/15 blur-3xl animate-blob-slow" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl animate-blob" />
      <div className="absolute inset-0 dot-grid" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-5xl px-4 py-24 sm:px-6"
      >
        <motion.p
          variants={fadeUp}
          className="font-mono text-sm uppercase tracking-[0.35em] text-teal-300"
        >
          {personal.location}
        </motion.p>

        <motion.h1
          variants={fadeUp}
          className="font-display mt-4 text-5xl font-extrabold leading-[1.05] sm:text-7xl"
        >
          {personal.name.split(" ")[0]}{" "}
          <span className="gradient-text">
            {personal.name.split(" ").slice(1).join(" ")}
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="font-display mt-4 text-xl font-semibold text-ink-dim sm:text-2xl"
        >
          {personal.title}
        </motion.p>

        <motion.p
          variants={fadeUp}
          className="mt-8 max-w-2xl text-base leading-relaxed text-ink-dim sm:text-lg"
        >
          {personal.summary}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${personal.email}`}
            className="rounded-lg bg-gradient-to-r from-teal-400 to-violet-400 px-5 py-3 text-sm font-semibold text-base transition hover:opacity-90 hover:shadow-lg hover:shadow-violet-400/20 active:scale-[0.98]"
          >
            Get in touch
          </a>
          <a
            href={personal.website}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink transition hover:border-teal-400/50 hover:bg-white/5"
          >
            {personal.website.replace(/^https?:\/\//, "")}
          </a>
          {editMode && (
            <EditButton
              onClick={() => openEditor({ kind: "personal" })}
              label="Edit intro"
            />
          )}
        </motion.div>

        <motion.a
          variants={fadeUp}
          href="#experience"
          aria-label="Scroll to experience"
          className="group absolute bottom-[-3rem] left-1/2 hidden -translate-x-1/2 sm:block"
        >
          <motion.span
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="block text-2xl text-ink-dim transition group-hover:text-teal-300"
          >
            ↓
          </motion.span>
        </motion.a>
      </motion.div>
    </section>
  );
}
