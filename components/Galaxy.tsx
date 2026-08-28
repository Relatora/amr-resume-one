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

// Black hole placement/size as viewport fractions - shared between the
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
      // the canvas's CSS box, not window.innerWidth - the latter includes
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
      // constellation pairs for the light theme - nearby stars, capped for perf
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
    // maps - differentially rotating spiral turbulence - so the gas visibly
    // flows around the hole, and the lensed arch above the shadow animates
    // in sync because it is the same material seen twice.
    const B_CRIT = 2.6; // sprite scale: half-width of the sprite in units of M
    const B_SHADOW = 2.568; // measured capture radius of this integrator
    const R_IN = 3.0; // disk inner edge (units of M)
    const R_OUT = 8.5; // disk outer edge
    const TILT = 0.06; // camera elevation above the disk plane (radians)
    const ROLL = -0.09; // cinematic lean applied when blitting
    const SPRITE_HW = 9.6; // sprite half-extent, geometrized units
    const SPRITE_HH = 5.2;
    const SS_BUDGET = 220000; // traced pixels; ~390ms one-time on a laptop
    const RING_W = 0.055; // photon-ring thickness in impact parameter
    const RING_GAIN = 1.7;
    const RING_ASYM = 0.45; // Doppler lopsidedness of the ring
    const MINR_NEARSIDE = 3.5; // closest approach separating near side from grazers
    const BASE_CLAMP = 5.0; // outlier ceiling for grazing rays at the rim
    const TURB_NORM = 0.3876; // mean of the three wave envelopes, so depth != dimming
    const RING_OMEGA = 2.4 / Math.pow(3.0, 1.5); // inner-edge orbital rate, drives ring shimmer
    const STRIDE = 12; // floats per animated texel

    let sprite: HTMLCanvasElement | null = null;
    let spriteCtx: CanvasRenderingContext2D | null = null;
    let spriteImg: ImageData | null = null;
    let spriteR = 0; // shadow radius (px) the sprite was built for
    let texIdx: Int32Array | null = null; // pixel index of each animated texel
    let texParams: Float32Array | null = null;
    let texCount = 0;
    let diskT = -1; // timestamp of the last texture update

    const buildGargantua = (rPx: number) => {
      const unit = rPx / B_CRIT;
      const full = 4 * SPRITE_HW * SPRITE_HH * unit * unit;
      const ss = Math.min(1, Math.max(0.4, Math.sqrt(SS_BUDGET / full)));
      const w = Math.ceil(2 * SPRITE_HW * unit * ss);
      const h = Math.ceil(2 * SPRITE_HH * unit * ss);
      if (w < 2 || h < 2) return; // degenerate viewport; retry next frame
      const n = w * h;

      const shadowCov = new Float32Array(n);
      const diskBase = new Float32Array(n);
      const hitR = new Float32Array(n);
      const hitPhi = new Float32Array(n);
      const ringI = new Float32Array(n);
      const ringPhi = new Float32Array(n);

      const cosT = Math.cos(TILT);
      const sinT = Math.sin(TILT);
      const px = 1 / (ss * unit); // world units per sprite pixel

      for (let j = 0; j < h; j++) {
        const sy = SPRITE_HH - (j + 0.5) * px;
        for (let i = 0; i < w; i++) {
          const sx = (i + 0.5) * px - SPRITE_HW;
          const h2 = sx * sx + sy * sy; // conserved angular momentum²
          const b = Math.sqrt(h2);
          const p = j * w + i;

          // The shadow is an exact circle - every ray inside b = 2.568 is
          // captured, at every azimuth. Computing its coverage analytically
          // gives a sub-pixel-smooth edge; letting chaotic rays vote on it,
          // as the previous version did, is what produced the dotted rim.
          if (b < B_SHADOW + px) {
            shadowCov[p] = Math.max(0, Math.min(1, 0.5 + (B_SHADOW - b) / px));
          }

          // Photon ring: light that wraps the hole piles up at the critical
          // curve. Rendered analytically because per-ray it is pure noise.
          if (b >= B_SHADOW - px && b < B_SHADOW + 1.1) {
            const d = Math.max(0, b - B_SHADOW);
            const az = Math.atan2(sy, sx);
            // same Doppler lopsidedness the traced disk carries
            ringI[p] = RING_GAIN * Math.exp(-d / RING_W) * (1 - RING_ASYM * Math.cos(az));
            ringPhi[p] = az;
          }

          if (h2 > 88) continue; // too far out for any light path

          let x = sx, y = sy, z = 10;
          let vx = 0, vy = 0, vz = -1;
          let side = y * cosT + z * sinT;
          let r2 = h2 + 100;
          let minR = 1e9;

          for (let s = 0; s < 520; s++) {
            r2 = x * x + y * y + z * z;
            const r1 = Math.sqrt(r2);
            if (r1 < minR) minR = r1;
            if (r2 < 1) break; // fell through the horizon
            const f = (-1.5 * h2) / (r2 * r2 * r1);
            const dt = Math.min(0.2, Math.max(0.02, 0.045 * r1));
            vx += f * x * dt; vy += f * y * dt; vz += f * z * dt;
            const px0 = x, py0 = y, pz0 = z;
            x += vx * dt; y += vy * dt; z += vz * dt;

            const sideN = y * cosT + z * sinT;
            if (side * sideN < 0) {
              // crossed the disk plane - interpolate the hit point
              const k = side / (side - sideN);
              const hx = px0 + (x - px0) * k;
              const hy = py0 + (y - py0) * k;
              const hz = pz0 + (z - pz0) * k;
              const rr = Math.sqrt(hx * hx + hy * hy + hz * hz);
              if (rr >= R_IN && rr <= R_OUT) {
                // Two ray families overlap near the shadow. The near-side disk
                // passing in front of the hole never comes close (minR ~ 5-8)
                // and must be kept - it is the band across the black face.
                // Rays grazing the photon sphere (minR ~ 1-2.6) clip the disk's
                // inner edge on their way in, and their Doppler-cubed radiance
                // swings wildly pixel to pixel: that is the dashed rim. Beyond
                // b0 + 0.5 the wrapped arch is smooth again, so the cut is local.
                if (!(b < B_SHADOW + 0.5 && minR < MINR_NEARSIDE)) {
                  let base = Math.pow(R_IN / rr, 2.2) * 1.7;
                  base *= Math.min(1, (R_OUT - rr) / 1.4); // outer fade
                  base *= Math.min(1, (rr - R_IN) / 0.25 + 0.15); // inner edge
                  // Doppler beaming: the orbit tangent's line-of-sight part
                  const dz = (-cosT * hx) / rr;
                  const beta = 0.5 * Math.sqrt(R_IN / rr);
                  const dopp = 1 / (1 - beta * dz);
                  diskBase[p] = base * dopp * dopp * dopp;
                  hitR[p] = rr;
                  hitPhi[p] = Math.atan2(hz, hx);
                }
                break;
              }
            }
            side = sideN;
            if (r2 > 180 || (z < -11 && vz < 0)) break; // escaped
          }
        }
      }

      // Mean-filter the rim band: what survives the cut above still spans a
      // huge dynamic range there, and a 3x3 mean turns the remaining grain
      // into the smooth gradient it physically is.
      const src = diskBase.slice();
      for (let j = 1; j < h - 1; j++) {
        const sy = SPRITE_HH - (j + 0.5) * px;
        for (let i = 1; i < w - 1; i++) {
          const sx = (i + 0.5) * px - SPRITE_HW;
          const b = Math.sqrt(sx * sx + sy * sy);
          if (b < B_SHADOW - 0.08 || b > B_SHADOW + 0.45) continue;
          const p = j * w + i;
          let sum = 0, cnt = 0;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const v = src[p + dj * w + di];
              if (v > 0) { sum += Math.min(v, BASE_CLAMP); cnt++; }
            }
          }
          if (cnt) diskBase[p] = sum / cnt;
        }
      }

      // Bake the pixels that never change; index the ones that animate and
      // precompute every constant their per-frame maths needs.
      const img = new ImageData(w, h);
      const idx = new Int32Array(n);
      const params = new Float32Array(n * STRIDE);
      let count = 0;
      for (let p = 0; p < n; p++) {
        const sc = shadowCov[p];
        const db = diskBase[p];
        const ri = ringI[p];
        if (db === 0 && ri === 0) {
          if (sc > 0) {
            // static: pure shadow, opaque black
            img.data[p * 4 + 3] = Math.round(sc * 255);
          }
          continue;
        }
        const rr = hitR[p];
        const phi = hitPhi[p];
        const omega = db > 0 ? 2.4 / Math.pow(rr, 1.5) : 0;
        const o = count * STRIDE;
        idx[count] = p;
        params[o] = sc;
        params[o + 1] = db;
        params[o + 2] = rr * 5.5 - 2 * phi; // wave 1 spatial phase
        params[o + 3] = 2.0 * omega; //        ...temporal frequency
        params[o + 4] = rr * 9.0 + 5 * phi + 1.7; // wave 2
        params[o + 5] = -5.0 * omega;
        params[o + 6] = rr * 2.3 - phi + 0.6; // wave 3
        params[o + 7] = 1.1 * omega;
        params[o + 8] = phi; // hot-spot reference azimuth
        params[o + 9] = omega;
        params[o + 10] = ri;
        params[o + 11] = 3 * ringPhi[p] - 0; // ring shimmer phase
        count++;
      }

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      sprite = c;
      spriteCtx = c.getContext("2d");
      spriteImg = img;
      texIdx = idx;
      texParams = params;
      texCount = count;
      diskT = -1;
    };

    // Recompute only the animated texels: three counter-shearing spiral waves
    // riding the Keplerian flow, plus two hot spots orbiting at their own
    // rates, plus the photon ring's shimmer.
    const updateDiskTexture = (t: number) => {
      if (!spriteCtx || !spriteImg || !texIdx || !texParams) return;
      const d = spriteImg.data;
      const prm = texParams;
      for (let k = 0; k < texCount; k++) {
        const o = k * STRIDE;
        const sc = prm[o];
        const db = prm[o + 1];
        let E = 0;
        if (db > 0) {
          const w1 = Math.sin(prm[o + 2] + prm[o + 3] * t);
          const w2 = Math.sin(prm[o + 4] + prm[o + 5] * t);
          const w3 = Math.sin(prm[o + 6] + prm[o + 7] * t);
          const phi = prm[o + 8];
          const om = prm[o + 9];
          // sharp orbiting hot spots - repeated squaring beats Math.pow here
          const c1 = Math.cos(phi - 1.9 * om * t);
          const c2 = Math.cos(phi - 3.1 * om * t + 2.4);
          const a1 = c1 > 0 ? c1 : 0;
          const a2 = c2 > 0 ? c2 : 0;
          const p2 = a1 * a1, p4 = p2 * p2, p8 = p4 * p4;
          const q2 = a2 * a2, q4 = q2 * q2, q8 = q4 * q4, q16 = q8 * q8;
          const spot = 0.6 * (p8 * p4) + 0.45 * (q16 * q4);
          // normalised so deeper contrast does not dim the disk
          const turb =
            ((0.6 + 0.4 * w1) * (0.76 + 0.24 * w2) * (0.85 + 0.15 * w3)) / TURB_NORM;
          E += db * turb * (1 + spot);
        }
        const ri = prm[o + 10];
        if (ri > 0) E += ri * (0.82 + 0.18 * Math.sin(prm[o + 11] - 6 * RING_OMEGA * t));

        const v = 1 - Math.exp(-E);
        // Gas in front of the hole must not be occluded by it: any ray that
        // reached the disk never crossed the horizon, so emission composites
        // over the black shadow, which composites over the sky.
        const alpha = 1 - (1 - sc) * (1 - v);
        const q = texIdx[k] * 4;
        if (alpha <= 0.002) { d[q + 3] = 0; continue; }
        const f = v / alpha; // the shadow contributes black, so gas is the colour
        const heat = Math.min(1, E * 0.6);
        d[q] = 255 * f;
        d[q + 1] = (118 + 137 * heat) * f;
        d[q + 2] = (26 + 210 * heat * heat) * f;
        d[q + 3] = Math.min(255, Math.round(alpha * 255));
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
      // the old conic-gradient "glint" stroked a hard 1.6px arc right on the
      // rim; the traced photon ring above is the real thing, so it is gone
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

      // constellation lines - light theme, only when cruising (not warping)
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

