"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: number;
  twinkleSpeed: number;
  drift: number;
}

interface ShootingStar {
  x: number;
  y: number;
  len: number;
  angle: number;
}

interface Nebula {
  fx: number; // position as viewport fraction
  fy: number;
  fr: number; // radius as fraction of min(w,h)
  dark: string; // rgb triplet for dark theme
  light: string; // rgb triplet for light theme
  phase: number;
  speed: number;
}

const NEBULAE: Nebula[] = [
  { fx: 0.18, fy: 0.28, fr: 0.62, dark: "45,212,191", light: "13,148,136", phase: 0, speed: 0.05 },
  { fx: 0.85, fy: 0.65, fr: 0.68, dark: "139,92,246", light: "124,58,237", phase: 2.1, speed: 0.04 },
  { fx: 0.5, fy: 0.95, fr: 0.56, dark: "244,114,182", light: "251,146,60", phase: 4.2, speed: 0.06 },
];

// Black hole placement/size as viewport fractions — shared between the
// renderer and the star loop (stars behind the event horizon are occluded).
const BH = { fx: 0.78, fy: 0.3, fr: 0.11 };

// Full-viewport animated space scene behind the site.
// Dark theme: twinkling stars, nebulas, shooting stars, and a Gargantua-style
// black hole. Light theme: an indigo constellation sketch with pastel nebulas
// and a soft sun. Scrolling sends the stars to warp in both themes.
export default function Galaxy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let pairs: Array<[number, number]> = [];
    let shooting: ShootingStar | null = null;
    let raf = 0;
    let warp = 0;
    let scrollAccum = 0;
    let lastScrollY = window.scrollY;

    const isLight = () => document.documentElement.classList.contains("light");

    const onScroll = () => {
      const y = window.scrollY;
      scrollAccum += Math.abs(y - lastScrollY);
      lastScrollY = y;
    };

    const resize = () => {
      // the canvas's CSS box, not window.innerWidth — the latter includes
      // the scrollbar and would skew drawing coordinates slightly
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(240, Math.floor((width * height) / 8000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.3 + 0.35,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.015 + Math.random() * 0.045,
        drift: 0.008 + Math.random() * 0.03,
      }));
      // constellation pairs for the light theme — nearby stars, capped for perf
      pairs = [];
      for (let i = 0; i < stars.length && pairs.length < 140; i++) {
        for (let j = i + 1; j < stars.length && pairs.length < 140; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          if (dx * dx + dy * dy < 110 * 110) pairs.push([i, j]);
        }
      }
    };

    const drawNebulae = (t: number, light: boolean) => {
      const minDim = Math.min(width, height);
      for (const n of NEBULAE) {
        const wobX = Math.sin(t * n.speed + n.phase) * width * 0.03;
        const wobY = Math.cos(t * n.speed * 0.8 + n.phase) * height * 0.03;
        const x = n.fx * width + wobX;
        const y = n.fy * height + wobY;
        const r = n.fr * minDim;
        const rgb = light ? n.light : n.dark;
        const alpha = light ? 0.17 : 0.26;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${rgb},${alpha})`);
        grad.addColorStop(0.35, `rgba(${rgb},${alpha * 0.6})`);
        grad.addColorStop(0.7, `rgba(${rgb},${alpha * 0.25})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    };

    // --- Gargantua ---------------------------------------------------------
    // A miniature general-relativity ray tracer, run once into an offscreen
    // sprite. For each pixel a light ray is marched backward past the hole
    // under Schwarzschild deflection (a = -1.5 h² x / r⁵ in geometrized
    // units); rays that spiral inside the photon sphere paint the shadow,
    // rays that strike the disk plane sample its glow. The lensed halo over
    // the shadow, the photon ring, and the Doppler-beamed bright side all
    // emerge from the geometry — none of them is painted on.
    const B_CRIT = 2.6; // critical impact parameter → apparent shadow radius
    const R_IN = 3.0; // disk inner edge (units of M)
    const R_OUT = 8.5; // disk outer edge
    const TILT = 0.06; // camera elevation above the disk plane (radians)
    const ROLL = -0.09; // cinematic lean applied when blitting
    const SPRITE_HW = 9.6; // sprite half-extent, geometrized units
    const SPRITE_HH = 5.2;
    let sprite: HTMLCanvasElement | null = null;
    let spriteR = 0; // shadow radius (px) the sprite was built for

    const buildGargantua = (rPx: number): HTMLCanvasElement => {
      const unit = rPx / B_CRIT;
      // render scale bounded so the one-time march stays around 100ms;
      // the upscale on blit reads as cinematic bloom
      const full = 4 * SPRITE_HW * SPRITE_HH * unit * unit;
      const ss = Math.min(0.9, Math.max(0.35, Math.sqrt(120000 / full)));
      const w = Math.ceil(2 * SPRITE_HW * unit * ss);
      const h = Math.ceil(2 * SPRITE_HH * unit * ss);
      const img = new ImageData(w, h);
      const d = img.data;
      const cosT = Math.cos(TILT);
      const sinT = Math.sin(TILT);

      for (let j = 0; j < h; j++) {
        const sy = SPRITE_HH - (j + 0.5) / (ss * unit);
        for (let i = 0; i < w; i++) {
          const sx = (i + 0.5) / (ss * unit) - SPRITE_HW;
          const h2 = sx * sx + sy * sy; // conserved angular momentum²
          if (h2 > 88) continue; // too far out for any light path

          let x = sx, y = sy, z = 10;
          let vx = 0, vy = 0, vz = -1;
          let side = y * cosT + z * sinT;
          let r2 = h2 + 100;
          let captured = false;
          let cg = 0, cb = 0, ca = 0;

          for (let s = 0; s < 380; s++) {
            r2 = x * x + y * y + z * z;
            if (r2 < 1) { captured = true; break; } // fell through the horizon
            const r1 = Math.sqrt(r2);
            const f = (-1.5 * h2) / (r2 * r2 * r1);
            const dt = Math.min(0.22, Math.max(0.03, 0.06 * r1));
            vx += f * x * dt; vy += f * y * dt; vz += f * z * dt;
            const px0 = x, py0 = y, pz0 = z;
            x += vx * dt; y += vy * dt; z += vz * dt;

            const sideN = y * cosT + z * sinT;
            if (side * sideN < 0) {
              // crossed the disk plane — interpolate the hit point
              const k = side / (side - sideN);
              const hx = px0 + (x - px0) * k;
              const hy = py0 + (y - py0) * k;
              const hz = pz0 + (z - pz0) * k;
              const rr = Math.sqrt(hx * hx + hy * hy + hz * hz);
              if (rr >= R_IN && rr <= R_OUT) {
                // emissivity falls with radius; faint spiral striations
                const phi = Math.atan2(hz, hx);
                let E = Math.pow(R_IN / rr, 2.2) * 1.7;
                E *= 0.82 + 0.18 * Math.sin(rr * 7 + phi * 3);
                E *= Math.min(1, (R_OUT - rr) / 1.4); // outer fade
                E *= Math.min(1, (rr - R_IN) / 0.25 + 0.15); // inner edge
                // Doppler beaming: the orbit tangent's line-of-sight part
                const dz = (-cosT * hx) / rr;
                const beta = 0.5 * Math.sqrt(R_IN / rr);
                const dopp = 1 / (1 - beta * dz);
                E *= dopp * dopp * dopp;
                const v = 1 - Math.exp(-E); // tone-map
                const heat = Math.min(1, E * 0.75);
                cg = 150 + 98 * heat;
                cb = 64 + 164 * heat;
                ca = Math.min(1, v * 1.5);
                break;
              }
            }
            side = sideN;
            if (r2 > 180 || (z < -11 && vz < 0)) break; // escaped
          }
          // rays still circling the photon sphere after the step budget
          if (!captured && ca === 0 && r2 < 9) captured = true;

          const o = (j * w + i) * 4;
          if (captured) {
            d[o + 3] = 255; // the shadow: opaque black
          } else if (ca > 0) {
            d[o] = 255;
            d[o + 1] = cg;
            d[o + 2] = cb;
            d[o + 3] = Math.round(ca * 255);
          }
        }
      }

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const sctx = c.getContext("2d");
      if (sctx) sctx.putImageData(img, 0, 0);
      return c;
    };

    const drawBlackHole = (t: number) => {
      const cx = width * BH.fx;
      const cy = height * BH.fy;
      const r = Math.min(width, height) * BH.fr;
      // the sprite scales cleanly on blit, so rebuild only on large jumps
      if (!sprite || r > spriteR * 1.3 || r < spriteR * 0.5) {
        sprite = buildGargantua(r);
        spriteR = r;
      }
      const shimmer = 0.85 + 0.15 * Math.sin(t * 0.8);
      const unit = r / B_CRIT;

      // ambient warmth thrown onto the surrounding space
      const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 3.2);
      glow.addColorStop(0, `rgba(255,170,90,${0.16 * shimmer})`);
      glow.addColorStop(1, "rgba(255,140,80,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ROLL);
      ctx.globalAlpha = 0.92 + 0.08 * Math.sin(t * 0.8);
      ctx.drawImage(
        sprite,
        -SPRITE_HW * unit,
        -SPRITE_HH * unit,
        2 * SPRITE_HW * unit,
        2 * SPRITE_HH * unit
      );
      ctx.globalAlpha = 1;

      // hot plasma knots riding the near side of the disk
      for (const phase of [0, 2.6]) {
        const a = t * 0.7 + phase;
        if (Math.sin(a) <= 0) continue; // behind the hole
        const hx = Math.cos(a) * r * 1.55;
        const hy = Math.sin(a) * r * 1.55 * 0.08;
        const hot = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.3);
        hot.addColorStop(0, `rgba(255,246,214,${0.5 * shimmer})`);
        hot.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = hot;
        ctx.beginPath();
        ctx.arc(hx, hy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // orbiting glint riding the photon ring
      if (typeof ctx.createConicGradient === "function") {
        const sweep = ctx.createConicGradient(t * 1.1, cx, cy);
        sweep.addColorStop(0, `rgba(255,248,225,${0.75 * shimmer})`);
        sweep.addColorStop(0.14, "rgba(255,224,168,0)");
        sweep.addColorStop(0.86, "rgba(255,224,168,0)");
        sweep.addColorStop(1, `rgba(255,248,225,${0.75 * shimmer})`);
        ctx.strokeStyle = sweep;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // The light theme's counterpart: a soft sun with a halo.
    const drawSun = (t: number) => {
      const cx = width * 0.8;
      const cy = height * 0.22;
      const r = Math.min(width, height) * 0.065;
      const breathe = 0.9 + 0.1 * Math.sin(t * 0.6);

      const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 4);
      halo.addColorStop(0, `rgba(253,224,150,${0.5 * breathe})`);
      halo.addColorStop(0.4, `rgba(251,191,120,${0.18 * breathe})`);
      halo.addColorStop(1, "rgba(251,191,120,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      core.addColorStop(0, "rgba(255,252,240,0.95)");
      core.addColorStop(1, "rgba(253,220,140,0.6)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(245,180,90,${0.35 * breathe})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawFrame = (animate: boolean, t: number) => {
      ctx.clearRect(0, 0, width, height);
      const light = isLight();

      // warp factor follows scroll velocity, easing back to rest
      if (animate) {
        const target = Math.min(scrollAccum * 0.6, 36);
        scrollAccum = 0;
        warp += (target - warp) * 0.16;
        if (warp < 0.05) warp = 0;
      }

      drawNebulae(t, light);
      if (light) drawSun(t);
      else drawBlackHole(t);

      const rgb = light ? "55,48,163" : "226,238,255";
      const maxAlpha = light ? 0.55 : 0.85;
      const warpCx = width / 2;
      const warpCy = height * 0.45;
      const maxDist = Math.hypot(warpCx, warpCy);
      // stars vanish behind the event horizon (dark theme only)
      const bhX = width * BH.fx;
      const bhY = height * BH.fy;
      const bhR = Math.min(width, height) * BH.fr;

      // constellation lines — light theme, only when cruising (not warping)
      if (light && warp < 2) {
        const lineAlpha = 0.13 * (1 - warp / 2);
        ctx.lineWidth = 0.7;
        for (const [i, j] of pairs) {
          const a = stars[i];
          const b = stars[j];
          ctx.strokeStyle = `rgba(${rgb},${lineAlpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const s of stars) {
        if (animate) {
          s.twinkle += s.twinkleSpeed;
          s.x -= s.drift;
          if (s.x < -2) s.x = width + 2;
        }
        if (!light && Math.hypot(s.x - bhX, s.y - bhY) < bhR) continue;
        const alpha = maxAlpha * (0.35 + 0.65 * Math.abs(Math.sin(s.twinkle)));

        if (warp > 0.5) {
          // stretch into a streak radiating from the warp center
          const dx = s.x - warpCx;
          const dy = s.y - warpCy;
          const d = Math.max(Math.hypot(dx, dy), 1);
          const len = warp * (0.3 + d / maxDist) * (s.r * 2.2);
          ctx.strokeStyle = `rgba(${rgb},${alpha})`;
          ctx.lineWidth = s.r;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + (dx / d) * len, s.y + (dy / d) * len);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${alpha})`;
          ctx.fill();
        }
      }

      // shooting stars only against a dark sky
      if (animate && !light) {
        if (!shooting && Math.random() < 0.0035) {
          shooting = {
            x: Math.random() * width * 0.7 + width * 0.15,
            y: Math.random() * height * 0.35,
            len: 0,
            angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4,
          };
        }
        if (shooting) {
          shooting.len += 13;
          const { x, y, len, angle } = shooting;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          const tail = Math.max(len - 90, 0);
          const grad = ctx.createLinearGradient(
            x + dx * tail,
            y + dy * tail,
            x + dx * len,
            y + dy * len
          );
          grad.addColorStop(0, "rgba(45,212,191,0)");
          grad.addColorStop(1, "rgba(230,240,255,0.9)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x + dx * tail, y + dy * tail);
          ctx.lineTo(x + dx * len, y + dy * len);
          ctx.stroke();
          if (len > 420) shooting = null;
        }
      }
    };

    const loop = (now: number) => {
      drawFrame(true, now / 1000);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });

    // Re-render the static frame on theme change when not animating.
    const observer = new MutationObserver(() => {
      if (reduced) drawFrame(false, 0);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (reduced) {
      drawFrame(false, 0);
    } else {
      // paint immediately so the scene shows even before the first rAF tick
      drawFrame(false, performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      {/* w/h-full is required: without CSS size a canvas renders at its
          intrinsic (DPR-scaled) pixel size and overflows on HiDPI displays */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

