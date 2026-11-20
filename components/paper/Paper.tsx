"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { loadWeather, subscribeWeather, type WeatherNow } from "@/lib/weather";
import SkyWords from "@/components/paper/SkyWords";
import { useSmoothScroll, wrap } from "@/components/paper/motion";

// The light theme's scenery, made like cut paper: every shape is a stack of
// flat sheets, each a shade darker and offset behind the one in front, with
// a soft shadow under it, so the depth comes from overlap rather than
// gradients. The page reads as a descent: a sun, birds and drifting cloud at
// the top, a cloud bank under the hero, and the sea at the foot of the page,
// where the sun has sunk to set into the waves.
//
// Everything here renders only in the light theme. The wrappers use the
// `[.light_&]` variant instead of a JS theme check, so there is no flash on
// load and nothing to hydrate differently from the server.
//
// Smoothness rules, because a parallax scene stutters easily:
// - Motion follows a sprung copy of the scroll position, not the raw one,
//   so wheel steps glide instead of jumping.
// - Anything that moves is an HTML element with `will-change: transform`.
//   That gives it its own compositor layer, so its SVG shadow filters are
//   painted once and then only moved. Transforming SVG children directly
//   would repaint the filters on every frame.

// ---------------------------------------------------------------- shared

// SVG filters and gradients used by every paper piece. They live in their
// own always-rendered SVG: a gradient or filter defined inside a
// display:none SVG is not resolvable from elsewhere in some browsers.
export function PaperDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        {/* Paper lying on paper: a short, soft shadow just below each sheet. */}
        <filter id="paper-shadow" x="-20%" y="-20%" width="140%" height="170%">
          <feDropShadow dx="0" dy="6" stdDeviation="4.5" floodColor="#1d4a73" floodOpacity="0.26" />
        </filter>
        {/* Waves stack front over back, so their shadow falls upward. */}
        <filter id="paper-shadow-up" x="-5%" y="-50%" width="110%" height="200%">
          <feDropShadow dx="0" dy="-5" stdDeviation="4" floodColor="#0b355c" floodOpacity="0.3" />
        </filter>
        <linearGradient id="paper-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#edf4f9" />
        </linearGradient>
        <radialGradient id="paper-sun" cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#ffe27f" />
          <stop offset="1" stopColor="#f6a823" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// Fine paper grain, tiled over the sky so the flat colour reads as stock.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.26 0 0 0 0 0.38 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// Viewport height for scroll maths, kept outside React state: transforms
// read it every frame and must not wait for a re-render.
function useViewportHeight() {
  const h = useRef(900);
  useEffect(() => {
    const set = () => (h.current = window.innerHeight);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  return h;
}

// Small deterministic hash, so scattered pieces land in the same places on
// every render and every visit.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Rounded to a tenth for anything rendered on the server: Node and the
// browser disagree in the last digits of Math.sin, and unrounded values
// would make the server HTML and the hydrated client differ.
const round = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------- the sky

// One cloud silhouette is a handful of overlapping circles on a rounded
// base, which is exactly how a paper cloud is cut and layered.
type Puff = [cx: number, cy: number, r: number];
const CLOUD_SHAPES: Puff[][] = [
  [[44, 62, 24], [80, 46, 32], [120, 50, 28], [154, 64, 20], [28, 70, 16]],
  [[40, 64, 20], [70, 50, 26], [104, 40, 32], [140, 54, 26], [168, 68, 16]],
  [[54, 58, 28], [96, 44, 34], [138, 58, 24], [30, 70, 14], [168, 72, 14]],
];

// Three sheets per cloud: a dusky back sheet offset furthest, a pale middle
// sheet, and the white front sheet, each casting its own shadow.
const CLOUD_SHEETS = [
  { fill: "#b9d3e7", dx: 11, dy: 12 },
  { fill: "#dbe9f4", dx: 5, dy: 6 },
  { fill: "url(#paper-cloud)", dx: 0, dy: 0 },
];

function CloudShape({ shape }: { shape: number }) {
  const puffs = CLOUD_SHAPES[shape % CLOUD_SHAPES.length];
  const body = (
    <>
      {puffs.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} />
      ))}
      <rect x="22" y="58" width="156" height="28" rx="14" />
    </>
  );
  return (
    <svg viewBox="0 0 200 100" className="block h-auto w-full overflow-visible">
      {CLOUD_SHEETS.map((sheet) => (
        <g key={sheet.fill} fill={sheet.fill} transform={`translate(${sheet.dx} ${sheet.dy})`} filter="url(#paper-shadow)">
          {body}
        </g>
      ))}
    </svg>
  );
}

// Where each cloud sits. x and w are in vw; y is in vh along a loop 150vh
// tall that the clouds cycle through as the page scrolls. Depth drives how
// fast a cloud moves with the scroll, its size, and how pale it is.
const CLOUDS = [
  { shape: 0, x: 4, y: 16, w: 15, depth: 0.25, sway: 34 },
  { shape: 1, x: 58, y: 6, w: 11, depth: 0.18, sway: 46 },
  // starts low on the first screen, below the name, which sits over sky
  { shape: 2, x: 34, y: 96, w: 21, depth: 0.5, sway: 28 },
  { shape: 0, x: 76, y: 62, w: 17, depth: 0.42, sway: 38 },
  { shape: 1, x: -6, y: 84, w: 27, depth: 0.78, sway: 24 },
  { shape: 2, x: 66, y: 104, w: 30, depth: 0.9, sway: 22 },
  { shape: 0, x: 40, y: 126, w: 19, depth: 0.6, sway: 30 },
];
const LOOP_VH = 150;

function DriftingCloud({
  cloud,
  index,
  scrollY,
  vh,
  register,
}: {
  cloud: (typeof CLOUDS)[number];
  index: number;
  scrollY: MotionValue<number>;
  vh: React.RefObject<number>;
  register: (el: HTMLDivElement | null) => void;
}) {
  // Scrolling lifts every cloud at its own depth's pace and pushes the near
  // ones sideways a little, wrapping so the sky never runs out.
  const y = useTransform(scrollY, (s) => {
    const travelled = (s / vh.current) * 100 * (0.25 + cloud.depth * 0.9);
    return `${wrap(cloud.y - travelled, LOOP_VH) - 25}vh`;
  });
  const x = useTransform(scrollY, (s) => s * 0.04 * cloud.depth * (index % 2 ? -1 : 1));

  return (
    <motion.div
      className="absolute will-change-transform"
      style={{
        left: `${cloud.x}vw`,
        top: 0,
        y,
        x,
        width: `max(${cloud.w}vw, ${Math.round(cloud.w * 9)}px)`,
        opacity: 0.74 + cloud.depth * 0.26,
        // every cloud sits in front of the sun and its beams (see PaperSky)
        zIndex: 10 + Math.round(cloud.depth * 10),
      }}
    >
      {/* A slow idle sway on top of the scroll motion keeps the sky alive
          while the visitor reads. */}
      <div
        ref={register}
        className="paper-sway"
        style={{ animationDuration: `${cloud.sway}s`, animationDelay: `-${index * 7}s` }}
      >
        <CloudShape shape={cloud.shape} />
      </div>
    </motion.div>
  );
}

// A sun cut from four sheets: thin back spikes, long rays, short front
// rays, and a disc with a stitched rim on a slightly larger collar.
function PaperSun({ rotate }: { rotate: MotionValue<number> }) {
  const rays = (n: number, inner: number, outer: number, half: number, offset: number) =>
    Array.from({ length: n }, (_, i) => (
      <polygon
        key={i}
        points={`0,${-outer} ${-half},${-inner} ${half},${-inner}`}
        transform={`rotate(${(360 / n) * i + offset})`}
      />
    ));
  return (
    <svg viewBox="-110 -110 220 220" className="block h-full w-full overflow-visible">
      <motion.g style={{ rotate }} filter="url(#paper-shadow)">
        <g fill="#e2701a">{rays(24, 52, 106, 5, 7.5)}</g>
        <g fill="#f08a1d">{rays(16, 50, 96, 10, 0)}</g>
        <g fill="#f8b532">{rays(16, 48, 79, 11, 11.25)}</g>
      </motion.g>
      <g filter="url(#paper-shadow)">
        <circle r="60" fill="#ee9a26" />
      </g>
      <g filter="url(#paper-shadow)">
        <circle r="55" fill="#f9c03c" />
        <circle r="49" fill="url(#paper-sun)" />
        <circle r="43" fill="none" stroke="#dd8a20" strokeWidth="1.6" strokeDasharray="3.2 4.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Sunbeams cut from paper: long tapered strips fanning out from the sun,
// each a pale front sheet over a slightly wider golden one, fading toward
// the tip. They sit behind the clouds, so when a cloud crosses the sun the
// beams shine out around its edges. No blur filter: the layer is several
// screens wide, and a filter on it would cost far more than flat sheets.
const BEAMS = 14;
function SunRays() {
  const beam = (i: number, back: boolean) => {
    const half = (i % 2 ? 1.8 : 3.0) + (back ? 0.7 : 0); // degrees
    const t = Math.tan((half * Math.PI) / 180);
    const inner = 8;
    const pts = `${-inner * t},${-inner} ${inner * t},${-inner} ${100 * t},-100 ${-100 * t},-100`;
    return (
      <polygon
        key={`${back ? "b" : "f"}${i}`}
        points={pts}
        fill={back ? "url(#sunbeam-back)" : "url(#sunbeam-front)"}
        transform={`rotate(${(360 / BEAMS) * i + (back ? 0.6 : 0)})`}
      />
    );
  };
  return (
    <svg viewBox="-100 -100 200 200" className="block h-full w-full">
      <defs>
        <radialGradient id="sunbeam-front" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
          <stop offset="0" stopColor="#fff6d6" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#fff6d6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sunbeam-back" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
          <stop offset="0" stopColor="#ffcf6b" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#ffd884" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffd884" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: BEAMS }, (_, i) => beam(i, true))}
      {Array.from({ length: BEAMS }, (_, i) => beam(i, false))}
    </svg>
  );
}

// A folded-paper bird: a body, a white near wing with a shaded fold, and a
// slate far wing, so it reads against the pale sky. The wings flap by
// scaling about the body line (see .paper-flap in CSS).
function PaperBird() {
  return (
    <svg viewBox="0 0 60 34" className="block h-auto w-full overflow-visible" filter="url(#paper-shadow)">
      <g className="paper-flap paper-flap-far">
        <polygon points="31,17 43,1 37,18" fill="#6f93b3" />
      </g>
      <polygon points="6,19 30,14 54,15 46,19 30,21" fill="#dbe6f0" />
      <polygon points="6,19 30,21 46,19" fill="#a9c1d6" />
      <polygon points="54,15 60,13 55,17" fill="#f0a33a" />
      <g className="paper-flap">
        <polygon points="30,17 16,2 26,19" fill="#ffffff" />
        <polygon points="30,17 22,9 26,19" fill="#c9dbea" />
      </g>
    </svg>
  );
}

// Flocks that cross the sky every so often. Each bird has its own height,
// size and wingbeat offset within the flock, and the whole flock drifts up
// with the scroll like the clouds do. `dir` -1 flies right to left.
// y is on the same 150vh loop as the clouds, which starts 25vh above the
// screen: 47 puts the first flock about a fifth of the way down.
const FLOCKS = [
  { y: 47, depth: 0.35, size: 4.6, duration: 38, delay: 14, dir: 1 },
  { y: 70, depth: 0.2, size: 3.2, duration: 52, delay: 30, dir: -1 },
];
const FLOCK_SHAPE: Array<[dx: number, dy: number, scale: number]> = [
  [0, 0, 1],
  [-5, 3.5, 0.82],
  [-9.5, -1.5, 0.74],
  [-13, 4, 0.62],
];

function Flock({
  flock,
  index,
  scrollY,
  vh,
}: {
  flock: (typeof FLOCKS)[number];
  index: number;
  scrollY: MotionValue<number>;
  vh: React.RefObject<number>;
}) {
  const y = useTransform(scrollY, (s) => {
    const travelled = (s / vh.current) * 100 * (0.2 + flock.depth * 0.8);
    return `${wrap(flock.y - travelled, LOOP_VH) - 25}vh`;
  });
  return (
    <motion.div className="absolute inset-x-0 top-0 z-[15] will-change-transform" style={{ y }}>
      <div
        className="paper-fly absolute left-0 top-0"
        style={{
          animationDuration: `${flock.duration}s`,
          animationDelay: `-${flock.delay}s`,
          animationDirection: flock.dir < 0 ? "reverse" : "normal",
        }}
      >
        <div style={{ transform: flock.dir < 0 ? "scaleX(-1)" : undefined }}>
          {FLOCK_SHAPE.map(([dx, dy, scale], b) => (
            <div
              key={b}
              className="paper-bob absolute"
              style={{
                left: `${dx}vw`,
                top: `${dy}vw`,
                width: `max(${flock.size * scale}vw, ${Math.round(flock.size * scale * 11)}px)`,
                animationDelay: `-${(b + index) * 0.7}s`,
                ["--flap-delay" as string]: `-${hash(b + index * 5) * 0.8}s`,
              }}
            >
              <PaperBird />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Paper raindrops, only when it is actually raining where the visitor is
// (the same live lookup the header weather chip uses). Snow falls as discs.
function PaperWeather() {
  const [w, setW] = useState<WeatherNow | null>(null);
  useEffect(() => {
    const off = subscribeWeather(setW);
    loadWeather();
    return () => {
      off();
    };
  }, []);
  if (!w || w.rain <= 0.02) return null;
  const count = Math.round(14 + w.rain * 36);
  const lean = Math.max(-1, Math.min(1, w.wind)) * 12;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ ["--lean" as string]: `${lean}deg` }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="paper-fall absolute top-0 block will-change-transform"
          style={{
            left: `${hash(i) * 100}%`,
            width: w.snow ? 10 : 9,
            animationDuration: `${(w.snow ? 9 : 4.2) + hash(i + 50) * 3}s`,
            animationDelay: `-${hash(i + 99) * 8}s`,
            zIndex: 30, // rain falls in front of everything
          }}
        >
          {w.snow ? (
            <svg viewBox="0 0 10 10" className="block w-full" filter="url(#paper-shadow)">
              <circle cx="5" cy="5" r="4.5" fill="#ffffff" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 15" className="block w-full" filter="url(#paper-shadow)">
              <path d="M5 0 C7 4 9.5 7 9.5 10 A4.5 4.5 0 0 1 0.5 10 C0.5 7 3 4 5 0 Z" fill="#9fd2ef" />
              <path d="M3.2 9 A2 2 0 0 0 4.4 12" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

const subscribeNoop = () => () => {};

// The fixed sky behind the light theme.
export function PaperSky() {
  const vh = useViewportHeight();
  const { scrollY, progress } = useSmoothScroll();
  // Rendered on the client only: the scroll maths reads the window.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // Layers, back to front: sky words (1), sunbeams (2), the sun (3),
  // clouds (10-19), birds (15), rain (30). The sun is behind every cloud;
  // its beams brighten when one covers it, so they shine around the edges.
  //
  // The sun's day: it starts high on the right and sinks along the page,
  // arriving just behind the sea at the very bottom. Its rays turn with
  // the scroll, and the sky warms toward sunset over the last stretch.
  const sunY = useTransform(progress, (p) => {
    // Starts clear of the fixed header (56px tall): the sun's size tracks
    // the clamp() in its class, and its centre sits half a sun below that.
    // (The server computes a first value too, with no window to measure.)
    const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
    const size = Math.min(250, Math.max(110, vw * 0.16));
    const start = 56 + 20 + size / 2;
    const end = vh.current - 190;
    return start + (end - start) * Math.pow(Math.min(1, Math.max(0, p)), 1.3);
  });
  const sunX = useTransform(progress, [0, 1], ["0vw", "-16vw"]);
  const rays = useTransform(scrollY, (s) => s * 0.05);
  const sunset = useTransform(progress, [0.72, 1], [0, 0.6]);
  const beamTurn = useTransform(scrollY, (s) => -s * 0.012);

  // How much of the sun a cloud covers, 0..1, measured from the elements'
  // on-screen boxes each frame. Transforms do not trigger layout, so the
  // reads are cheap. The beams are faint in open sky and shine fully when
  // the sun is behind a cloud.
  const sunRef = useRef<HTMLDivElement>(null);
  const cloudEls = useRef<(HTMLDivElement | null)[]>([]);
  const cover = useMotionValue(0);
  const coverEased = useSpring(cover, { stiffness: 50, damping: 18 });
  const beamOpacity = useTransform(coverEased, [0, 1], [0.1, 1]);
  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const tick = () => {
      const sun = sunRef.current;
      if (sun && document.documentElement.classList.contains("light")) {
        const b = sun.getBoundingClientRect();
        const r = b.width * 0.25; // the disc, inside the rays
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        let best = 0;
        for (const el of cloudEls.current) {
          if (!el) continue;
          const c = el.getBoundingClientRect();
          // the cloud's solid body, not its padded box
          const L = c.left + c.width * 0.08;
          const R = c.right - c.width * 0.08;
          const T = c.top + c.height * 0.25;
          const B = c.bottom - c.height * 0.05;
          const ox = Math.max(0, Math.min(R, cx + r) - Math.max(L, cx - r));
          const oy = Math.max(0, Math.min(B, cy + r) - Math.max(T, cy - r));
          best = Math.max(best, (ox * oy) / (4 * r * r));
        }
        cover.set(Math.min(1, best * 1.4));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mounted, cover]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden [.light_&]:block">
      <div className="absolute inset-0 bg-gradient-to-b from-[#bfe2f5] via-[#dcf0fa] to-[#eef8fd]" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-[#ffe3c2]/40 to-[#ffcf9e]"
        style={{ opacity: sunset }}
      />
      <div className="absolute inset-0 opacity-[0.45] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      {mounted && (
        <>
          {/* Farthest layer: the focus keywords, written faintly across the
              sky. Every cloud, bird and the sun pass in front of them. */}
          <div className="absolute inset-0 z-[1]">
            <SkyWords theme="light" />
          </div>
          {/* The beams share the sun's position, one layer further back. */}
          <motion.div
            className="absolute right-[8vw] top-0 z-[2] h-[clamp(110px,16vw,250px)] w-[clamp(110px,16vw,250px)] will-change-transform"
            style={{ y: sunY, x: sunX, translateY: "-50%", opacity: beamOpacity }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] will-change-transform"
              style={{ x: "-50%", y: "-50%", rotate: beamTurn }}
            >
              <SunRays />
            </motion.div>
          </motion.div>
          <motion.div
            ref={sunRef}
            className="absolute right-[8vw] top-0 z-[3] h-[clamp(110px,16vw,250px)] w-[clamp(110px,16vw,250px)] will-change-transform"
            style={{ y: sunY, x: sunX, translateY: "-50%" }}
          >
            <PaperSun rotate={rays} />
          </motion.div>
          {FLOCKS.map((f, i) => (
            <Flock key={i} flock={f} index={i} scrollY={scrollY} vh={vh} />
          ))}
          {CLOUDS.map((c, i) => (
            <DriftingCloud
              key={i}
              cloud={c}
              index={i}
              scrollY={scrollY}
              vh={vh}
              register={(el) => {
                cloudEls.current[i] = el;
              }}
            />
          ))}
          <PaperWeather />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- cloud bank

// The bank of cloud under the hero: rows of overlapping puffs, lumpy on
// top and underneath so the bank floats rather than ending in a flat edge.
// As the page scrolls the rows lift at different rates and slide apart;
// they lift rather than sink because the hero clips anything below it.
const BANK_ROWS = [
  { fill: "#c9def0", base: 52, r: [26, 46], lift: 0.02 },
  { fill: "#dcecf7", base: 68, r: [30, 52], lift: 0.04 },
  { fill: "#eef6fb", base: 86, r: [34, 58], lift: 0.07 },
  { fill: "#ffffff", base: 106, r: [38, 64], lift: 0.11 },
];

export function PaperCloudBank() {
  const { scrollY } = useSmoothScroll();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-4 hidden h-40 sm:h-48 [.light_&]:block">
      {BANK_ROWS.map((row, ri) => (
        <BankRow key={ri} row={row} index={ri} scrollY={scrollY} />
      ))}
    </div>
  );
}

function BankRow({
  row,
  index,
  scrollY,
}: {
  row: (typeof BANK_ROWS)[number];
  index: number;
  scrollY: MotionValue<number>;
}) {
  const y = useTransform(scrollY, (s) => -Math.min(s * row.lift, 70));
  const x = useTransform(scrollY, (s) => s * 0.06 * (index % 2 ? 1 : -1));
  // Puffs laid edge to edge across a strip wider than the screen, so the
  // sideways drift never shows an end.
  const puffs: Puff[] = [];
  for (let x0 = -120, i = 0; x0 < 1560; i++) {
    const r = row.r[0] + hash(i + index * 31) * (row.r[1] - row.r[0]);
    const cx = x0 + r;
    puffs.push([round(cx), round(row.base - hash(i + 7 + index * 13) * 18), round(r)]);
    // the underside: smaller puffs hanging below the body
    puffs.push([round(cx + r * 0.3), round(row.base + 34), round(r * 0.62)]);
    x0 += r * 1.35;
  }
  return (
    <motion.div className="absolute inset-0 will-change-transform" style={{ y, x }}>
      <svg viewBox="0 0 1440 200" preserveAspectRatio="xMidYMax slice" className="h-full w-full overflow-visible">
        <g fill={row.fill} filter="url(#paper-shadow)">
          {puffs.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
          <rect x="-200" y={row.base} width="1840" height="34" />
        </g>
      </svg>
    </motion.div>
  );
}

// ---------------------------------------------------------------- waves

export interface WaveLayer {
  fill: string;
  amp: number; // wave height, in viewBox units
  length: number; // wavelength; must divide 1440 so the strip tiles
  base: number; // baseline from the top of the strip
  speed: number; // sideways travel per pixel scrolled, signed
}

// The crest of a smooth periodic wave, drawn over twice the viewBox width.
const crestPath = ({ amp, length, base }: WaveLayer) => {
  let d = `M0 ${base} Q${length / 4} ${base - amp} ${length / 2} ${base}`;
  for (let x = length / 2; x < 2880; x += length / 2) d += ` T${x + length / 2} ${base}`;
  return d;
};

// One sheet of sea. The sheet is twice the strip's width and slides by up
// to half of itself, wrapping, so it tiles seamlessly; the slide is a
// percentage transform on an HTML layer, which the compositor can move
// without repainting the shadow.
function WaveBand({ layer, height, scrollY }: { layer: WaveLayer; height: number; scrollY: MotionValue<number> }) {
  const x = useTransform(scrollY, (s) => `${-(wrap(s * layer.speed, 1440) / 2880) * 100}%`);
  const crest = crestPath(layer);
  return (
    <motion.div className="absolute inset-y-0 left-0 w-[200%] will-change-transform" style={{ x }}>
      <svg viewBox={`0 0 2880 ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <path d={`${crest} L2880 ${height} L0 ${height} Z`} fill={layer.fill} filter="url(#paper-shadow-up)" />
        {/* The cut edge catching the light along the crest. */}
        <path d={crest} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </motion.div>
  );
}

// A strip of layered paper waves that slide against each other as the page
// scrolls. Used for the sea at the bottom of the page and, small, as the
// light theme's section dividers.
export function PaperWaves({
  layers,
  height,
  className = "",
  flip = false,
}: {
  layers: WaveLayer[];
  height: number;
  className?: string;
  flip?: boolean;
}) {
  const { scrollY } = useSmoothScroll();
  return (
    <div aria-hidden className={`pointer-events-none relative w-full overflow-hidden ${flip ? "rotate-180" : ""} ${className}`}>
      {layers.map((l, i) => (
        <WaveBand key={i} layer={l} height={height} scrollY={scrollY} />
      ))}
    </div>
  );
}

// The sea the page ends in: pale shallows at the back, one band of sunlit
// gold, and deep blue at the front.
export const OCEAN: WaveLayer[] = [
  { fill: "#c3e6f7", amp: 14, length: 480, base: 46, speed: 0.08 },
  { fill: "#90cdee", amp: 16, length: 360, base: 78, speed: -0.12 },
  { fill: "#f4bd4f", amp: 10, length: 720, base: 110, speed: 0.16 },
  { fill: "#5aaade", amp: 18, length: 480, base: 132, speed: -0.2 },
  { fill: "#2f80c0", amp: 20, length: 360, base: 172, speed: 0.26 },
];
