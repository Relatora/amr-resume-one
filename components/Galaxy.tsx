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
      // the scrollbar and would skew drawing coordinates slightly (the
      // window fallback covers a detached canvas mid-HMR, which reads 0)
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
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
    // A miniature general-relativity ray tracer. The geometry is traced once
    // into per-pixel maps: for each pixel a light ray is marched backward
    // past the hole under Schwarzschild deflection (a = -1.5 h² x / r⁵ in
    // geometrized units). Rays that spiral inside the photon sphere paint
    // the shadow; rays that strike the disk plane record their hit point
    // (radius, azimuth) and static shading (emissivity falloff, Doppler
    // beaming). Each frame only the disk *texture* is recomputed from those
    // maps — differentially rotating spiral turbulence — so the gas visibly
    // flows around the hole, and the lensed arch above the shadow animates
    // in sync because it is the same material seen twice.
    const B_CRIT = 2.6; // critical impact parameter → apparent shadow radius
    const R_IN = 3.0; // disk inner edge (units of M)
    const R_OUT = 8.5; // disk outer edge
    const TILT = 0.06; // camera elevation above the disk plane (radians)
    const ROLL = -0.09; // cinematic lean applied when blitting
    const SPRITE_HW = 9.6; // sprite half-extent, geometrized units
    const SPRITE_HH = 5.2;
    let sprite: HTMLCanvasElement | null = null;
    let spriteCtx: CanvasRenderingContext2D | null = null;
    let spriteImg: ImageData | null = null;
    let spriteR = 0; // shadow radius (px) the sprite was built for
    let diskIdx: Int32Array | null = null; // pixel index of each disk texel
    let diskParams: Float32Array | null = null; // base,a1,b1,a2,b2 per texel
    let diskCount = 0;
    let diskT = -1; // timestamp of the last texture update

    const buildGargantua = (rPx: number) => {
      const unit = rPx / B_CRIT;
      // render scale bounded so the one-time march stays fast; the upscale
      // on blit reads as cinematic bloom
      const full = 4 * SPRITE_HW * SPRITE_HH * unit * unit;
      const ss = Math.min(1, Math.max(0.4, Math.sqrt(120000 / full)));
      const w = Math.ceil(2 * SPRITE_HW * unit * ss);
      const h = Math.ceil(2 * SPRITE_HH * unit * ss);
      if (w < 2 || h < 2) return; // degenerate viewport; retry next frame
      const n = w * h;
      // classification per pixel: 0 empty, 1 disk, 2 shadow
      const cls = new Uint8Array(n);
      const hitR = new Float32Array(n);
      const hitPhi = new Float32Array(n);
      const hitBase = new Float32Array(n);
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
          const p = j * w + i;

          for (let s = 0; s < 520; s++) {
            r2 = x * x + y * y + z * z;
            if (r2 < 1) { cls[p] = 2; break; } // fell through the horizon
            const r1 = Math.sqrt(r2);
            const f = (-1.5 * h2) / (r2 * r2 * r1);
            const dt = Math.min(0.2, Math.max(0.02, 0.045 * r1));
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
                let base = Math.pow(R_IN / rr, 2.2) * 1.7;
                base *= Math.min(1, (R_OUT - rr) / 1.4); // outer fade
                base *= Math.min(1, (rr - R_IN) / 0.25 + 0.15); // inner edge
                // Doppler beaming: the orbit tangent's line-of-sight part
                const dz = (-cosT * hx) / rr;
                const beta = 0.5 * Math.sqrt(R_IN / rr);
                const dopp = 1 / (1 - beta * dz);
                cls[p] = 1;
                hitR[p] = rr;
                hitPhi[p] = Math.atan2(hz, hx);
                hitBase[p] = base * dopp * dopp * dopp;
                break;
              }
            }
            side = sideN;
            if (r2 > 180 || (z < -11 && vz < 0)) break; // escaped
          }
          // rays still circling the photon sphere after the step budget
          if (cls[p] === 0 && r2 < 9) cls[p] = 2;
        }
      }

      // Despeckle the rim: near the critical radius neighboring rays flip
      // chaotically between captured and disk-hit, which reads as noise.
      // Majority-vote isolated pixels against their 4-neighborhood.
      const cls0 = cls.slice();
      for (let j = 1; j < h - 1; j++) {
        const sy = SPRITE_HH - (j + 0.5) / (ss * unit);
        for (let i = 1; i < w - 1; i++) {
          const sx = (i + 0.5) / (ss * unit) - SPRITE_HW;
          const b = Math.sqrt(sx * sx + sy * sy);
          if (b < 2.0 || b > 3.6) continue;
          const p = j * w + i;
          const nb = [p - 1, p + 1, p - w, p + w];
          const diskN = nb.filter((q) => cls0[q] === 1);
          const shadowN = nb.filter((q) => cls0[q] === 2);
          if (cls0[p] === 2 && diskN.length >= 3) {
            const q = diskN[0];
            cls[p] = 1;
            hitR[p] = hitR[q];
            hitPhi[p] = hitPhi[q];
            hitBase[p] = hitBase[q];
          } else if (cls0[p] === 1 && shadowN.length >= 3) {
            cls[p] = 2;
          }
        }
      }

      // bake the static pixels; index the animated disk texels
      const img = new ImageData(w, h);
      const idx = new Int32Array(n);
      const params = new Float32Array(n * 5);
      let count = 0;
      for (let p = 0; p < n; p++) {
        if (cls[p] === 2) {
          img.data[p * 4 + 3] = 255; // the shadow: opaque black
        } else if (cls[p] === 1) {
          const rr = hitR[p];
          const phi = hitPhi[p];
          // Keplerian angular speed — inner gas laps the outer gas, which
          // shears the turbulence into trailing spirals
          const omega = 2.4 / Math.pow(rr, 1.5);
          const o = count * 5;
          idx[count] = p;
          params[o] = hitBase[p];
          params[o + 1] = rr * 6 - 2 * phi; // spiral wave 1 spatial phase
          params[o + 2] = 2 * omega; //           ...temporal frequency
          params[o + 3] = rr * 11 + 5 * phi + 1.7; // spiral wave 2
          params[o + 4] = 5 * omega;
          count++;
        }
      }

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      sprite = c;
      spriteCtx = c.getContext("2d");
      spriteImg = img;
      diskIdx = idx;
      diskParams = params;
      diskCount = count;
      diskT = -1;
    };

    // Recompute only the disk texels from the traced maps — two counter-
    // shearing spiral waves riding the Keplerian flow.
    const updateDiskTexture = (t: number) => {
      if (!spriteCtx || !spriteImg || !diskIdx || !diskParams) return;
      const d = spriteImg.data;
      for (let k = 0; k < diskCount; k++) {
        const o = k * 5;
        const E =
          diskParams[o] *
          (0.8 + 0.2 * Math.sin(diskParams[o + 1] + diskParams[o + 2] * t)) *
          (0.9 + 0.1 * Math.sin(diskParams[o + 3] - diskParams[o + 4] * t));
        const v = 1 - Math.exp(-E); // tone-map
        const heat = Math.min(1, E * 0.75);
        const q = diskIdx[k] * 4;
        d[q] = 255;
        d[q + 1] = 150 + 98 * heat;
        d[q + 2] = 64 + 164 * heat;
        d[q + 3] = Math.min(255, Math.round(v * 1.5 * 255));
      }
      spriteCtx.putImageData(spriteImg, 0, 0);
    };

    const drawBlackHole = (t: number) => {
      const cx = width * BH.fx;
      const cy = height * BH.fy;
      const r = Math.min(width, height) * BH.fr;
      // the sprite scales cleanly on blit, so rebuild only on large jumps
      if (!sprite || r > spriteR * 1.3 || r < spriteR * 0.5) {
        buildGargantua(r);
        spriteR = r;
      }
      if (!sprite) return;
      // refresh the flowing gas at ~30fps; the blit itself runs every frame
      if (diskT < 0 || Math.abs(t - diskT) > 0.033) {
        updateDiskTexture(t);
        diskT = t;
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
      ctx.globalAlpha = 0.94 + 0.06 * Math.sin(t * 0.8);
      ctx.drawImage(
        sprite,
        -SPRITE_HW * unit,
        -SPRITE_HH * unit,
        2 * SPRITE_HW * unit,
        2 * SPRITE_HH * unit
      );
      ctx.globalAlpha = 1;
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

