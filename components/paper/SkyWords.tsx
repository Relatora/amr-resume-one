"use client";

import { useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { useSmoothScroll, wrap } from "@/components/paper/motion";

// The focus keywords written across the sky: huge, faint words that sit
// behind everything else on the page, cards and clouds included, so they
// read as part of the backdrop rather than as content. Each row drifts
// sideways with the scroll, alternating direction, and the rows rise slowly
// on a loop like the farthest clouds. The words come from
// personal.keywords in content.json, editable in the intro form.
//
// They only appear on the part of the page from the top of Projects to the
// top of Contact: the layer is masked to that band of the screen, with soft
// edges, and the mask follows the sections as the page scrolls. The hero
// and the closing call to action stay clear, and Education keeps the words
// even where it shares the screen with Contact.
//
// Rendered twice: inside the paper sky (light theme, below the clouds) and
// under the galaxy canvas (dark theme, so stars and the black hole are drawn
// over the words). The `theme` prop picks the styling.
// Each keyword keeps one colour wherever it appears: its position in the
// keyword list picks one of the palette slots (.sky-c0 to .sky-c5).

// Sideways travel per pixel scrolled, as a percentage of the row.
const SLIDE = 0.006;
// Vertical loop: rows rise this fraction of the scroll, wrapping over a
// span of this many vh. Slower than any cloud, so the words sit furthest.
const RISE = 0.12;
const LOOP_VH = 140;

const ROW_STARTS = [10, 38, 66, 94, 122]; // vh along the loop
// Soft edge of the visible band, in px, at the top of Projects and Contact.
const FEATHER = 160;

// Where the words show, as page offsets of the section tops. Measured from
// the DOM and re-measured whenever the page's height changes (a role's
// bullets expanding, the editor adding an entry), so the range stays true.
// Motion values rather than a ref, so a new measurement re-renders the mask
// at once; until the first one lands, the band sits far below the page.
function useSectionRange() {
  const projectsTop = useMotionValue(1e6);
  const contactTop = useMotionValue(1e6);
  useEffect(() => {
    const measure = () => {
      const top = (id: string) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY : 1e6;
      };
      projectsTop.set(top("projects"));
      contactTop.set(top("contact"));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [projectsTop, contactTop]);
  return { projectsTop, contactTop };
}

export default function SkyWords({ theme }: { theme: "light" | "dark" }) {
  const { content } = useContent();
  const words = content.personal.keywords ?? [];
  const { scrollY } = useSmoothScroll();
  const { projectsTop, contactTop } = useSectionRange();
  // The band's edges in viewport coordinates. They track the real scroll
  // position, not the sprung one the words drift with, so the band stays
  // locked to the sections it frames.
  const { scrollY: rawY } = useScroll();
  const top = useTransform(() => projectsTop.get() - rawY.get());
  const bottom = useTransform(() => contactTop.get() - rawY.get());
  const topIn = useTransform(top, (v) => v + FEATHER);
  const bottomIn = useTransform(bottom, (v) => v - FEATHER);
  const mask = useMotionTemplate`linear-gradient(to bottom, transparent ${top}px, #000 ${topIn}px, #000 ${bottomIn}px, transparent ${bottom}px)`;
  if (words.length === 0) return null;

  // Each row starts on a different keyword, so neighbouring rows never line
  // up on the same word.
  const rows = ROW_STARTS.map((_, i) => {
    const k = (i * 2) % words.length;
    return [...words.slice(k), ...words.slice(0, k)];
  });

  return (
    // Two layers: the outer one is masked to the page band, the inner one
    // carries the theme's fixed strength (opacity) from CSS.
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div className={`sky-layer-${theme} absolute inset-0`}>
        {rows.map((row, i) => (
          <Row
            key={i}
            words={row}
            colorOf={(w) => words.indexOf(w) % 6}
            start={ROW_STARTS[i]}
            reverse={i % 2 === 1}
            theme={theme}
            scrollY={scrollY}
          />
        ))}
      </div>
    </motion.div>
  );
}

function Row({
  words,
  colorOf,
  start,
  reverse,
  theme,
  scrollY,
}: {
  words: string[];
  colorOf: (word: string) => number;
  start: number;
  reverse: boolean;
  theme: "light" | "dark";
  scrollY: MotionValue<number>;
}) {
  // The track holds two identical halves, so sliding it by up to half its
  // width and wrapping never shows an end.
  const x = useTransform(scrollY, (s) => {
    const d = wrap(s * SLIDE, 50);
    return reverse ? `${d - 50}%` : `${-d}%`;
  });
  const y = useTransform(scrollY, (s) => {
    const vh = typeof window === "undefined" ? 900 : window.innerHeight;
    return `${wrap(start - (s / vh) * 100 * RISE, LOOP_VH) - 30}vh`;
  });

  return (
    <motion.div className="absolute left-0 top-0 will-change-transform" style={{ y }}>
      <motion.div className="flex w-max will-change-transform" style={{ x }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0">
            {[...words, ...words].map((w, i) => (
              <span
                key={i}
                className={`sky-word sky-word-${theme} sky-c${colorOf(w)} whitespace-nowrap px-[0.22em] font-extrabold leading-none tracking-[-0.01em]`}
              >
                {w}
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
