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
      {/* Animated background. The blobs are positioned past the section's
          edges, and the section clips them, so the amber one used to end on a
          hard horizontal line right below the buttons. This wrapper masks the
          bottom of the layer so they dissolve before the boundary reaches
          them; mask-repeat has to be off or the gradient tiles. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_96%)] [mask-repeat:no-repeat] [mask-size:100%_100%] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_96%)] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%]"
      >
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-teal-500/15 blur-3xl animate-blob" />
        <div className="absolute top-1/4 -right-32 h-[28rem] w-[28rem] rounded-full bg-violet-500/15 blur-3xl animate-blob-slow" />
        <div className="absolute bottom-24 left-1/4 h-96 w-96 rounded-full bg-amber-500/12 blur-3xl animate-blob" />
      </div>
      <div className="absolute inset-0 dot-grid" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-5xl px-4 py-24 sm:px-6"
      >
        <motion.p
          variants={fadeUp}
          className="font-mono text-sm uppercase tracking-[0.35em] text-accent-teal"
        >
          {personal.location}
        </motion.p>

        <motion.h1
          variants={fadeUp}
          className="font-display mt-4 text-5xl font-extrabold leading-[1.05] sm:text-7xl"
        >
          <span className="gradient-text">{personal.name}</span>
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
            className="press rounded-lg bg-gradient-to-r from-teal-400 to-violet-400 px-5 py-3 text-sm font-semibold text-on-accent transition hover:opacity-90 hover:shadow-lg hover:shadow-violet-400/20 active:scale-[0.98]"
          >
            Get in touch
          </a>
          <a
            href="/resume"
            download
            className="press rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink transition hover:border-teal-400/50 hover-veil"
          >
            Download resume (PDF)
          </a>
          {personal.github && (
            <a
              href={personal.github}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex items-center gap-2 rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink transition hover:border-teal-400/50 hover-veil"
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="h-4 w-4 fill-current"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              GitHub
            </a>
          )}
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
            className="block text-2xl text-ink-dim transition group-hover:text-accent-teal"
          >
            ↓
          </motion.span>
        </motion.a>
      </motion.div>
    </section>
  );
}
