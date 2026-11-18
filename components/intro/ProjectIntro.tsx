"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { ProjectEntry } from "@/lib/types";
import { CUTS, EXPO, FADE, accentAt } from "@/components/intro/transitions";

// The intro is cut like a short ad: a cold open, one beat per project, and an
// outro where the cards fly into the header's replay button. Every beat hangs
// off one clock (a MotionValue in ms), so pausing, skipping ahead and the
// progress bars all read the same number and cannot drift apart.

const OPEN_MS = 850;
const SLIDE_MS = 1450;
const OUTRO_MS = 950;

// Flash frames are rate-limited, whatever triggers them (the timeline or a
// visitor hammering the arrow keys). 400 ms keeps the spot at 2.5 flashes a
// second at most, under the WCAG 2.3.1 limit of three.
const MIN_FLASH_GAP_MS = 400;

type Segment =
  | { kind: "open"; start: number; end: number }
  | { kind: "project"; index: number; start: number; end: number }
  | { kind: "outro"; start: number; end: number };

function buildTimeline(projectCount: number): Segment[] {
  const segments: Segment[] = [{ kind: "open", start: 0, end: OPEN_MS }];
  for (let i = 0; i < projectCount; i++) {
    const start = OPEN_MS + i * SLIDE_MS;
    segments.push({ kind: "project", index: i, start, end: start + SLIDE_MS });
  }
  const outroStart = OPEN_MS + projectCount * SLIDE_MS;
  segments.push({ kind: "outro", start: outroStart, end: outroStart + OUTRO_MS });
  return segments;
}

interface Props {
  open: boolean;
  projects: ProjectEntry[];
  brand: string;
  onClose: () => void;
}

export default function ProjectIntro({ open, projects, brand, onClose }: Props) {
  // Remounting the spot on every play resets its clock for free.
  return (
    <AnimatePresence>
      {open && <Spot key="spot" projects={projects} brand={brand} onClose={onClose} />}
    </AnimatePresence>
  );
}

function Spot({ projects, brand, onClose }: Omit<Props, "open">) {
  const reduce = useReducedMotion() ?? false;
  const timeline = useMemo(() => buildTimeline(projects.length), [projects.length]);
  const total = timeline[timeline.length - 1].end;

  const clock = useMotionValue(0);
  const [seg, setSeg] = useState(0);
  const [flash, setFlash] = useState({ id: 0, color: accentAt(0) });
  const segRef = useRef(0);
  const lastFlash = useRef(-Infinity);
  const held = useRef(false);
  // Mirrors `held` for the "Paused" label; the clock reads the ref.
  const [paused, setPaused] = useState(false);
  const done = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onClose();
  }, [onClose]);

  // Moving to a new segment is the one place a flash frame is fired.
  const enter = useCallback(
    (i: number) => {
      segRef.current = i;
      setSeg(i);
      // Every cut starts unheld. The card that was being hovered is gone,
      // and its pointerleave never fires once it unmounts, so a hold left
      // over from it would freeze the spot until the mouse moved.
      held.current = false;
      setPaused(false);
      const now = performance.now();
      if (now - lastFlash.current < MIN_FLASH_GAP_MS) return;
      lastFlash.current = now;
      const s = timeline[i];
      const color = s.kind === "project" ? accentAt(s.index) : "#e7ecf6";
      setFlash((f) => ({ id: f.id + 1, color }));
    },
    [timeline]
  );

  const seek = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(timeline.length - 1, i));
      clock.set(timeline[target].start);
      enter(target);
    },
    [clock, enter, timeline]
  );

  useAnimationFrame((_, delta) => {
    if (held.current || done.current) return;
    // Clamp the step: after a background tab wakes up, delta can be seconds
    // long, and the spot should resume rather than jump to the end.
    const t = clock.get() + Math.min(delta, 100);
    clock.set(t);
    if (t >= total) return finish();
    let i = segRef.current;
    while (i < timeline.length - 1 && t >= timeline[i].end) i++;
    if (i !== segRef.current) enter(i);
  });

  // While open: lock page scroll, focus Skip, preload every screenshot so no
  // cut lands on a blank frame. On close, hand focus back where it was.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    skipRef.current?.focus({ preventScroll: true });
    for (const p of projects) new window.Image().src = p.image;
    return () => {
      root.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [projects]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") seek(segRef.current + 1);
      else if (e.key === "ArrowLeft") seek(Math.max(1, segRef.current - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, seek]);

  const current = timeline[seg];
  const hold = useCallback((on: boolean) => {
    if (held.current === on) return;
    held.current = on;
    setPaused(on);
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Project highlights"
      className="fixed inset-0 z-[70] overflow-hidden text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      {/* The spot is always dark, whatever the site theme: it is a piece of
          film laid over the page, and flash frames need a dark ground to read.
          It thins out during the outro so the header shows through and the
          visitor sees where the cards land. Clicking it skips the intro. */}
      <motion.div
        aria-hidden
        onClick={finish}
        className="absolute inset-0 bg-[#04060d]/95 backdrop-blur-md"
        animate={{ opacity: current.kind === "outro" ? 0.6 : 1 }}
        transition={{ duration: 0.6 }}
      />
      <div aria-hidden className="intro-scanlines pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {current.kind === "open" && <Opener key="open" brand={brand} reduce={reduce} />}
          {current.kind === "project" && (
            <Slide
              key={projects[current.index].id}
              project={projects[current.index]}
              index={current.index}
              reduce={reduce}
              onHold={hold}
            />
          )}
          {current.kind === "outro" && (
            <Outro key="outro" projects={projects} reduce={reduce} />
          )}
        </AnimatePresence>
      </div>

      {!reduce && <Flash key={flash.id} color={flash.color} />}

      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="flex flex-1 gap-1.5">
          {projects.map((p, i) => (
            <ProgressBar
              key={p.id}
              clock={clock}
              segment={timeline[i + 1]}
              accent={accentAt(i)}
              label={`Show ${p.name}`}
              onClick={() => seek(i + 1)}
            />
          ))}
        </div>
        <AnimatePresence>
          {paused && (
            <motion.span
              className="text-xs text-white/60"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              Paused
            </motion.span>
          )}
        </AnimatePresence>
        <button
          ref={skipRef}
          onClick={finish}
          className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          Skip
          <kbd className="ml-2 font-sans text-xs text-white/50">Esc</kbd>
        </button>
      </div>

      {/* Screen readers get the project names as they change, not the
          letter-by-letter animation. */}
      <p className="sr-only" aria-live="polite">
        {current.kind === "project"
          ? `${projects[current.index].name}: ${projects[current.index].tagline}`
          : ""}
      </p>
    </motion.div>
  );
}

// A story-style progress segment; also a button that jumps to its project.
function ProgressBar({
  clock,
  segment,
  accent,
  label,
  onClick,
}: {
  clock: MotionValue<number>;
  segment: Segment;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  const fill = useTransform(clock, [segment.start, segment.end], [0, 1]);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="group flex h-6 flex-1 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-teal-300"
    >
      <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/15 transition group-hover:bg-white/30">
        <motion.span
          className="absolute inset-0 origin-left rounded-full"
          style={{ scaleX: fill, background: accent, boxShadow: `0 0 12px ${accent}` }}
        />
      </span>
    </button>
  );
}

// A single burst of light at each cut: white core, accent falloff.
function Flash({ color }: { color: string }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 mix-blend-screen"
      style={{
        background: `radial-gradient(circle at 50% 45%, rgba(255,255,255,0.9), ${color}cc 35%, ${color}00 75%)`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.85, 0] }}
      transition={{ duration: 0.26, times: [0, 0.2, 1], ease: "easeOut" }}
    />
  );
}

// Cold open: a line draws across, the title slams in from wide tracking, and
// on exit it splits into a top and bottom half that fly apart.
function Opener({ brand, reduce }: { brand: string; reduce: boolean }) {
  const title = `Built by ${brand}`;
  const halves = [
    { clip: "inset(0 0 50% 0)", y: -36 },
    { clip: "inset(50% 0 0 0)", y: 36 },
  ];
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-4"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <motion.div
        className="h-px w-[min(520px,70vw)] bg-gradient-to-r from-transparent via-teal-300 to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: reduce ? 0 : 0.45, ease: [0.7, 0, 0.2, 1] }}
      />
      <div className="relative mt-6">
        {/* Invisible copy sets the size; the two clipped halves sit on it. */}
        <h2 className="font-display invisible text-[clamp(2.5rem,8vw,6rem)] font-extrabold leading-none tracking-[-0.03em]">
          {title}
        </h2>
        {halves.map((h, i) => (
          <motion.span
            key={h.clip}
            aria-hidden={i > 0}
            className="font-display absolute inset-0 flex justify-center whitespace-nowrap text-[clamp(2.5rem,8vw,6rem)] font-extrabold leading-none"
            style={{ clipPath: h.clip }}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, letterSpacing: "0.45em", filter: "blur(12px)" }
            }
            animate={{ opacity: 1, letterSpacing: "-0.03em", filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { y: h.y, opacity: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.12, ease: EXPO }}
          >
            {title}
          </motion.span>
        ))}
      </div>
      <motion.p
        className="mt-5 text-sm text-white/60 sm:text-base"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.3, duration: 0.4 }}
      >
        Selected projects
      </motion.p>
    </motion.div>
  );
}

function Slide({
  project,
  index,
  reduce,
  onHold,
}: {
  project: ProjectEntry;
  index: number;
  reduce: boolean;
  onHold: (on: boolean) => void;
}) {
  const cut = reduce ? FADE : CUTS[index % CUTS.length];
  const accent = accentAt(index);
  // An outgoing slide keeps rendering through its exit cut; it must not be
  // able to grab the hold for the slide that replaced it.
  const isPresent = useIsPresent();
  const holdIfPresent = (on: boolean) => isPresent && onHold(on);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-4 pt-10"
      initial={cut.initial}
      animate={cut.animate}
      exit={cut.exit}
    >
      {/* Moving the mouse over the card, or tabbing into it, holds the clock
          so a visitor who wants to read or click a link is not cut off.
          pointermove rather than pointerenter: a card that appears under a
          resting cursor fires an enter without the visitor doing anything,
          and that would stop the spot on its own. */}
      {/* Width also follows the viewport height (16:10 frame plus ~340px of
          caption and chrome), so a short laptop screen never crops it. */}
      <div
        className={`w-[min(760px,100%,calc((100svh-340px)*1.6))] ${isPresent ? "pointer-events-auto" : ""}`}
        onPointerMove={(e) => e.pointerType === "mouse" && holdIfPresent(true)}
        onPointerLeave={() => holdIfPresent(false)}
        onFocus={() => holdIfPresent(true)}
        onBlur={() => holdIfPresent(false)}
      >
        <div style={{ perspective: 1400 }}>
          <motion.div
            className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/15 bg-black"
            style={{ boxShadow: `0 40px 140px -30px ${accent}99, 0 0 0 1px ${accent}22` }}
            initial={reduce ? false : { rotateX: 16, rotateY: -18, y: 40 }}
            animate={reduce ? undefined : { rotateX: 5, rotateY: -4, y: 0 }}
            transition={{ duration: SLIDE_MS / 1000 + 0.3, ease: EXPO }}
          >
            {/* Ken Burns drift, plus a brightness spike that decays: the
                screenshot itself flashes on the hit. */}
            <motion.div
              className="absolute inset-0"
              initial={
                reduce ? false : { scale: 1.2, x: "2%", filter: "brightness(2.2) saturate(1.4)" }
              }
              animate={reduce ? undefined : { scale: 1.04, x: "-1%", filter: "brightness(1) saturate(1)" }}
              transition={{
                scale: { duration: 1.9, ease: "easeOut" },
                x: { duration: 1.9, ease: "linear" },
                filter: { duration: 0.45, ease: "easeOut" },
              }}
            >
              {/* unoptimized: the files are already 1280x800 webp, and serving
                  them as-is lets the spot preload the exact URLs it shows. */}
              <Image
                src={project.image}
                alt={project.imageAlt}
                fill
                unoptimized
                priority={index === 0}
                sizes="(max-width: 800px) 100vw, 760px"
                className="object-cover object-top"
              />
            </motion.div>
            {cut.glitch && <GlitchBands src={project.image} accent={accent} />}
            {!reduce && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                initial={{ x: "0%" }}
                animate={{ x: "500%" }}
                transition={{ delay: 0.45, duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
              />
            )}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
            />
          </motion.div>
        </div>

        {/* The caption overlaps the bottom of the frame, like a title card. */}
        <div className="relative -mt-12 px-3 sm:-mt-16 sm:px-8">
          <h2
            aria-label={project.name}
            className="font-display text-[clamp(2.25rem,7vw,5.25rem)] font-extrabold leading-[0.95] tracking-[-0.035em]"
          >
            <SlamText text={project.name} reduce={reduce} delay={0.15} />
          </h2>
          <motion.p
            className="mt-3 max-w-xl text-base text-white/75 sm:text-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0.1 : 0.4, duration: 0.4, ease: EXPO }}
          >
            {project.tagline}
          </motion.p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {project.tags.map((tag, i) => (
              <motion.span
                key={tag}
                className="rounded-full border px-2.5 py-0.5 text-xs text-white/85"
                style={{ borderColor: `${accent}66`, background: `${accent}14` }}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (reduce ? 0.1 : 0.5) + i * 0.05, type: "spring", stiffness: 500, damping: 24 }}
              >
                {tag}
              </motion.span>
            ))}
            <span className="ml-auto flex gap-2">
              {project.live && <SpotLink href={project.live}>Open the app</SpotLink>}
              <SpotLink href={project.repo} github>
                View on GitHub
              </SpotLink>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Letters hit one after another with a skew, a blur and an RGB split that
// settles into a plain drop shadow. Words stay unbreakable so a long name
// wraps between words, never mid-word.
function SlamText({ text, reduce, delay }: { text: string; reduce: boolean; delay: number }) {
  let n = 0;
  return (
    <span aria-hidden>
      {text.split(" ").map((word, w) => (
        <span key={w}>
          {w > 0 && " "}
          <span className="inline-block whitespace-nowrap">
            {[...word].map((ch) => {
              const i = n++;
              return (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: "0.45em",
                          skewX: -18,
                          filter: "blur(10px)",
                          textShadow:
                            "-6px 0px 0px rgba(255,40,140,0.9), 6px 0px 0px rgba(40,220,255,0.9)",
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: "0em",
                    skewX: 0,
                    filter: "blur(0px)",
                    textShadow:
                      "0px 0px 0px rgba(255,40,140,0), 0px 6px 28px rgba(0,0,0,0.55)",
                  }}
                  transition={{ delay: delay + i * 0.022, duration: 0.45, ease: EXPO }}
                >
                  {ch}
                </motion.span>
              );
            })}
          </span>
        </span>
      ))}
    </span>
  );
}

// The incoming screenshot torn into horizontal bands that shear sideways for
// a third of a second. Offsets are fixed, not random, so every render (and
// every screenshot of it) is the same.
const BAND_SHIFTS = [-14, 9, -22, 6, 17, -8, 12];

function GlitchBands({ src, accent }: { src: string; accent: string }) {
  const n = BAND_SHIFTS.length;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {BAND_SHIFTS.map((shift, i) => (
        <motion.div
          key={i}
          className="absolute inset-x-0"
          style={{
            top: `${(i * 100) / n}%`,
            height: `${100 / n + 0.5}%`,
            backgroundImage:
              i % 2
                ? `linear-gradient(${accent}55, ${accent}55), url(${src})`
                : `url(${src})`,
            backgroundSize: `100% ${n * 100}%`,
            backgroundPosition: `0 ${(i * 100) / (n - 1)}%`,
            backgroundBlendMode: "screen",
          }}
          initial={{ x: `${shift}%`, opacity: 1 }}
          animate={{ x: [`${shift}%`, `${-shift * 0.5}%`, "0%"], opacity: [1, 1, 0] }}
          transition={{ duration: 0.32, times: [0, 0.5, 1], ease: "linear" }}
        />
      ))}
    </div>
  );
}

function SpotLink({
  href,
  github,
  children,
}: {
  href: string;
  github?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#04060d] transition hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
    >
      {github && (
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      )}
      {children}
    </a>
  );
}

// Where the outro cards fly to: the replay button in the header, measured as
// an offset from the viewport centre. Falls back to the top-right corner if
// the button is not on screen.
function measureReplayButton() {
  const el = document.getElementById("intro-replay");
  const r = el?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth - 40;
  const y = r ? r.top + r.height / 2 : 28;
  return { x: x - window.innerWidth / 2, y: y - window.innerHeight / 2 };
}

// Outro: every card fans out as a deck for a beat, then the deck collapses
// into the replay button, one card after another.
function Outro({ projects, reduce }: { projects: ProjectEntry[]; reduce: boolean }) {
  // Measured once, when the outro mounts (client-only: the spot never renders
  // on the server).
  const [target] = useState(measureReplayButton);
  const mid = (projects.length - 1) / 2;

  return (
    <motion.div className="absolute inset-0 flex items-center justify-center">
      {projects.map((p, i) => {
        const off = i - mid;
        const fan = { x: off * 115, y: Math.abs(off) * 16, rotate: off * 9 };
        return (
          <motion.div
            key={p.id}
            className="absolute aspect-[16/10] w-[min(300px,60vw)] overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl"
            style={{ boxShadow: `0 20px 60px -20px ${accentAt(i)}aa` }}
            initial={{ opacity: 0, scale: 0.7, x: 0, y: 30, rotate: 0 }}
            animate={
              reduce
                ? { opacity: [0, 1, 1, 0], scale: 1, x: fan.x, y: 0, rotate: 0 }
                : {
                    // Stays opaque until it is almost in the button, so the
                    // landing is visible rather than a fade into nothing.
                    opacity: [0, 1, 1, 1, 0],
                    scale: [0.7, 1, 1, 0.08],
                    x: [0, fan.x, fan.x, target.x],
                    y: [30, fan.y, fan.y, target.y],
                    rotate: [0, fan.rotate, fan.rotate, 0],
                  }
            }
            transition={{
              duration: OUTRO_MS / 1000 - 0.15,
              delay: i * 0.035,
              times: [0, 0.35, 0.55, 1],
              ease: "easeInOut",
              opacity: {
                duration: OUTRO_MS / 1000 - 0.15,
                delay: i * 0.035,
                times: [0, 0.2, 0.55, 0.92, 1],
              },
            }}
          >
            <Image src={p.image} alt="" fill unoptimized sizes="300px" className="object-cover object-top" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
