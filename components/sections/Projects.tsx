"use client";

import { useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { ProjectEntry } from "@/lib/types";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import SectionHeading from "@/components/ui/SectionHeading";
import { EditButton } from "@/components/ui/EditControls";
import { accentAt } from "@/components/intro/transitions";
import { useTilt } from "@/components/ui/useTilt";
import { useHydrated } from "@/lib/useHydrated";

// Projects: one big card per project, stacked like a deck. On wide screens
// each card pins as it reaches the top and the next one slides over it,
// while the cards underneath shrink back a step, so scrolling deals the
// deck. Cards tilt toward the cursor with a moving glare. On phones, and
// for reduced motion, the deck lays out as a plain column.

// Each pinned card sits a little lower than the one before, so the edges of
// the cards behind it stay visible as a stack.
const STACK_OFFSET = 26;
const SCALE_STEP = 0.05;

const wideQuery = "(min-width: 768px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(wideQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(wideQuery).matches,
    () => true
  );
}

export default function Projects() {
  const { content } = useContent();
  const { editMode, openEditor } = useEditor();
  const projects = content.projects ?? [];
  const deck = useRef<HTMLDivElement>(null);
  // Device-dependent choices wait for hydration, so the first client render
  // matches the server's (which assumes a wide screen with motion on).
  const hydrated = useHydrated();
  const prefersReduced = useReducedMotion() ?? false;
  const reduce = hydrated && prefersReduced;
  const wide = useWide();
  const stacked = !hydrated || (wide && !reduce);
  const { scrollYProgress } = useScroll({ target: deck, offset: ["start start", "end end"] });

  if (projects.length === 0 && !editMode) return null;

  return (
    <section id="projects" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <SectionHeading eyebrow="Built in public" title="Projects" />
          {editMode && (
            <EditButton onClick={() => openEditor({ kind: "projects" })} label="Edit projects" />
          )}
        </div>
      </div>

      <div ref={deck} className="mx-auto max-w-6xl px-4 sm:px-6">
        {projects.map((p, i) => (
          <DeckSlot
            key={p.id}
            project={p}
            index={i}
            count={projects.length}
            progress={scrollYProgress}
            stacked={stacked}
            reduce={reduce}
          />
        ))}
      </div>
    </section>
  );
}

// One position in the deck. When stacked, the slot is a tall sticky frame
// and the card inside shrinks as the deck scrolls past its turn.
function DeckSlot({
  project,
  index,
  count,
  progress,
  stacked,
  reduce,
}: {
  project: ProjectEntry;
  index: number;
  count: number;
  progress: MotionValue<number>;
  stacked: boolean;
  reduce: boolean;
}) {
  const slot = useRef<HTMLDivElement>(null);
  // A card starts shrinking when its own turn is over and ends one step
  // smaller for every card that lands on top of it.
  const scale = useTransform(progress, [index / count, 1], [1, 1 - (count - 1 - index) * SCALE_STEP]);
  // The screenshot drifts inside its frame while the card travels in.
  const { scrollYProgress: arrive } = useScroll({ target: slot, offset: ["start end", "start start"] });
  const imageScale = useTransform(arrive, [0, 1], [1.18, 1]);
  const imageY = useTransform(arrive, [0, 1], ["-6%", "0%"]);

  return (
    <div
      ref={slot}
      className={stacked ? "sticky top-0 flex h-[100svh] items-center" : "py-4"}
    >
      <motion.div
        className="w-full"
        style={
          stacked
            ? { scale, top: index * STACK_OFFSET, position: "relative", transformOrigin: "top center" }
            : undefined
        }
        initial={stacked || reduce ? false : { opacity: 0, y: 40 }}
        whileInView={stacked || reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <ProjectCard
          project={project}
          index={index}
          imageScale={reduce ? undefined : imageScale}
          imageY={reduce ? undefined : imageY}
          tilt={stacked}
        />
      </motion.div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  imageScale,
  imageY,
  tilt,
}: {
  project: ProjectEntry;
  index: number;
  imageScale?: MotionValue<number>;
  imageY?: MotionValue<string>;
  tilt: boolean;
}) {
  const accent = accentAt(index);

  const { handlers, style: tiltStyle, glare } = useTilt({ accent, enabled: tilt });

  return (
    <div style={{ perspective: 1600 }}>
      <motion.article
        {...handlers}
        style={tiltStyle}
        className="group relative grid overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_40px_120px_-40px_rgba(2,6,23,0.45)] md:min-h-[min(560px,78svh)] md:grid-cols-[1.25fr_1fr]"
      >
        {/* Accent wash in the corner, and the glare that follows the cursor. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70 [.light_&]:opacity-25"
          style={{ background: accent }}
        />
        {tilt && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glare }}
          />
        )}

        {/* Screenshot frame */}
        <div className="relative p-4 sm:p-6 md:p-8 md:pr-0">
          <div
            className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-canvas md:aspect-auto md:h-full"
            style={{ boxShadow: `0 30px 80px -30px color-mix(in oklab, ${accent} 55%, transparent)` }}
          >
            <motion.div className="absolute inset-0" style={{ scale: imageScale, y: imageY }}>
              <Image
                src={project.image}
                alt={project.imageAlt}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            </motion.div>
          </div>
        </div>

        {/* Copy */}
        <div className="relative z-10 flex flex-col justify-center gap-5 p-6 sm:p-8 md:p-10">
          <ul className="flex flex-wrap gap-2">
            {project.tags.map((t) => (
              <li
                key={t}
                className="rounded-full border px-3 py-1 text-xs font-medium text-ink"
                style={{
                  borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
                  background: `color-mix(in oklab, ${accent} 10%, transparent)`,
                }}
              >
                {t}
              </li>
            ))}
          </ul>
          <h3 className="font-display text-[clamp(2rem,4.2vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            {project.name}
          </h3>
          <p className="text-base leading-relaxed text-ink-dim sm:text-lg">{project.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90"
              style={{ background: accent }}
            >
              <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-current">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              View on GitHub
            </a>
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                className="press hover-veil rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition"
              >
                Open the app
              </a>
            )}
          </div>
        </div>
      </motion.article>
    </div>
  );
}
