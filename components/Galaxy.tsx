"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number; // depth 0 = far, 1 = near; drives size, brightness and parallax
  r: number;
  twinkle: number;
  twinkleSpeed: number;
  drift: number;
}

// A mote of interstellar dust: large, barely-there, soft-edged. Depth makes
// the near ones bigger, softer and faster, which is the cue that turns a flat
// sheet of dots into something with distance in it.
interface Dust {
  x: number;
  y: number;
  z: number;
  r: number;
  a: number;
  sway: number;
  phase: number;
  speed: number;
  tint: number; // index into the mote sprites
}

// A comet is a nucleus, a coma around it, and a tail streaming behind. Two
// flavours cross the dark sky: blazing ones in gold and icy ones in pale
// cyan. The shooting star this replaces was a single gradient line.
interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  len: number;
  size: number;
  icy: boolean;
  wobble: number;
}

// Light theme is a different sky entirely: overcast cloud with rain falling
// through it, instead of stars.
interface Cloud {
  x: number;
  y: number;
  z: number; // depth: near clouds are larger, faster and more opaque
  w: number;
  h: number;
  puffs: Array<{ dx: number; dy: number; r: number; a: number }>;
  speed: number;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  len: number;
  speed: number;
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

// Scene feature switches. Comets are built and working but held back for now.
const FEATURES = {
  comets: false,
  liveWeather: true, // light theme mirrors the visitor's real conditions
};

// Black hole placement/size as viewport fractions - shared between the
// renderer and the star loop (stars behind the event horizon are occluded).
const BH = { fx: 0.78, fy: 0.3, fr: 0.11 };

// Full-viewport animated space scene behind the site.
// Dark theme: twinkling stars, nebulas, comets, and a Gargantua-style
// black hole. Light theme: an overcast sky with rain falling through drifting
// cloud. Scrolling sends the stars to warp, and the rain to streak.
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
    let dust: Dust[] = [];
    let moteSprites: HTMLCanvasElement[] = [];
    let scrollY = window.scrollY; // absolute offset, for parallax
    const comets: Comet[] = [];
    let clouds: Cloud[] = [];
    let rain: Drop[] = [];
    let prevT = -1; // for a real delta time, so motion is frame-rate independent
    // Live conditions for the light theme. Defaults are what shows before the
    // lookup lands, and what stays if it never does.
    let weather = { rain: 0, snow: false, cloud: 0.7, wind: 0.2, label: "" };
    let weatherAsked = false;
    let rainSeeds: Float32Array | null = null;
    let raf = 0;
    let warp = 0;
    let scrollAccum = 0;
    let lastScrollY = window.scrollY;

    const isLight = () => document.documentElement.classList.contains("light");

    // Only ask once, and only when the light sky is on screen - a dark-theme
    // visitor should not pay for a request they will never see the effect of.
    const ensureWeather = () => {
      if (weatherAsked || !FEATURES.liveWeather) return;
      weatherAsked = true;
      fetch("/api/weather")
        .then((r) => (r.ok ? r.json() : null))
        .then((w) => {
          if (w && typeof w.rain === "number") {
            weather = { rain: w.rain, snow: !!w.snow, cloud: w.cloud, wind: w.wind, label: w.label };
          }
        })
        .catch(() => {
          // keep the defaults; the backdrop must never depend on this
        });
    };

    const onScroll = () => {
      const y = window.scrollY;
      scrollY = y;
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
      const count = Math.min(260, Math.floor((width * height) / 7600));
      stars = Array.from({ length: count }, () => {
        // biased toward the far field, so the sky reads as mostly distant
        const z = Math.pow(Math.random(), 1.6);
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          r: 0.3 + z * 1.45,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.015 + Math.random() * 0.045,
          drift: 0.004 + z * 0.05, // near stars slide past faster
        };
      });

      const dustCount = Math.min(95, Math.floor((width * height) / 15000));
      dust = Array.from({ length: dustCount }, () => {
        const z = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          r: 6 + z * 46,
          a: 0.026 + (1 - z) * 0.042 + z * 0.062,
          sway: 6 + Math.random() * 26,
          phase: Math.random() * Math.PI * 2,
          speed: 0.05 + Math.random() * 0.16,
          tint: Math.floor(Math.random() * 3),
        };
      });
      // Light theme population: a few layered cloud masses and a rain field.
      const cloudCount = Math.max(7, Math.min(12, Math.round(width / 170)));
      clouds = Array.from({ length: cloudCount }, () => {
        const z = Math.random();
        const w = (0.22 + z * 0.3) * width;
        const h = w * (0.3 + Math.random() * 0.2);
        // each cloud is a cluster of soft puffs, so the silhouette is lumpy
        const n = 5 + Math.floor(Math.random() * 4);
        return {
          x: Math.random() * (width + w) - w / 2,
          y: Math.random() * height * 0.62 - h * 0.2,
          z,
          w,
          h,
          speed: 4 + z * 16,
          puffs: Array.from({ length: n }, (_, i) => ({
            dx: (i / (n - 1) - 0.5) * w * 0.8 + (Math.random() - 0.5) * w * 0.12,
            dy: (Math.random() - 0.5) * h * 0.5,
            r: h * (0.5 + Math.random() * 0.55),
            a: 0.2 + Math.random() * 0.22,
          })),
        };
      });

      const dropCount = Math.min(420, Math.floor((width * height) / 3400));
      rainSeeds = new Float32Array(dropCount).map(() => Math.random());
      rain = Array.from({ length: dropCount }, () => {
        const z = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          len: 7 + z * 20,
          speed: 420 + z * 900,
        };
      });

      buildMotes();
    };

    // One soft mote per tint, rendered once and stamped with drawImage. Doing
    // this per particle per frame with createRadialGradient would be far too
    // costly; a cached sprite makes the whole dust field nearly free.
    const MOTE_DARK: Array<[number, number, number]> = [
      [120, 170, 210],
      [150, 130, 210],
      [210, 160, 190],
    ];
    const MOTE_LIGHT: Array<[number, number, number]> = [
      [90, 110, 150],
      [110, 95, 155],
      [150, 115, 135],
    ];
    let moteTheme = "";

    const buildMotes = (light = isLight()) => {
      const key = light ? "light" : "dark";
      if (moteTheme === key && moteSprites.length) return;
      moteTheme = key;
      const size = 128;
      moteSprites = (light ? MOTE_LIGHT : MOTE_DARK).map(([r, g, b]) => {
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const cc = c.getContext("2d");
        if (cc) {
          const grad = cc.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
          grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
          grad.addColorStop(0.35, `rgba(${r},${g},${b},0.42)`);
          grad.addColorStop(0.7, `rgba(${r},${g},${b},0.1)`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          cc.fillStyle = grad;
          cc.fillRect(0, 0, size, size);
        }
        return c;
      });
    };

    // Stamps one depth slice of the dust field. Called twice per frame so the
    // far motes sit behind the stars and the near ones drift in front.
    const drawDust = (t: number, near: boolean) => {
      if (!moteSprites.length) return;
      const wrapW = width + 200;
      const wrapH = height + 200;
      for (const m of dust) {
        if (near !== m.z >= 0.5) continue;
        const x = m.x - t * (3 + m.z * 16) + Math.sin(m.phase + t * m.speed) * m.sway;
        const y =
          m.y +
          scrollY * (0.05 + m.z * 0.75) +
          Math.cos(m.phase * 1.3 + t * m.speed * 0.8) * m.sway * 0.5;
        const px = (((x % wrapW) + wrapW) % wrapW) - 100;
        const py = (((y % wrapH) + wrapH) % wrapH) - 100;
        ctx.globalAlpha = m.a;
        ctx.drawImage(moteSprites[m.tint], px - m.r, py - m.r, m.r * 2, m.r * 2);
      }
      ctx.globalAlpha = 1;
    };

    // Depth haze: a soft band of galactic light plus corner falloff. Two
    // gradient fills, which is what gives the emptiness somewhere to recede to.
    const drawHaze = (light: boolean) => {
      const bandY = height * 0.52;
      const bandH = height * 0.42;
      const band = ctx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
      const hz = light ? "120,140,190" : "150,170,220";
      const hzA = light ? 0.05 : 0.055;
      band.addColorStop(0, `rgba(${hz},0)`);
      band.addColorStop(0.5, `rgba(${hz},${hzA})`);
      band.addColorStop(1, `rgba(${hz},0)`);
      ctx.fillStyle = band;
      ctx.fillRect(0, bandY - bandH, width, bandH * 2);

      const maxD = Math.hypot(width / 2, height / 2);
      const vig = ctx.createRadialGradient(
        width / 2, height / 2, maxD * 0.55,
        width / 2, height / 2, maxD
      );
      const vc = light ? "120,130,160" : "3,5,12";
      const va = light ? 0.16 : 0.42;
      vig.addColorStop(0, `rgba(${vc},0)`);
      vig.addColorStop(1, `rgba(${vc},${va})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    };

    // --- overcast sky, clouds and rain (light theme) ----------------------
    // An overcast wash: cooler and heavier at the top, opening up toward the
    // horizon, which is what stops a grey sky reading as flat grey.
    const drawOvercast = () => {
      const k = 0.35 + weather.cloud * 0.65; // clear skies stay pale
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, `rgba(150,168,196,${(0.42 * k).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(176,190,214,${(0.26 * k).toFixed(3)})`);
      g.addColorStop(0.78, `rgba(214,220,232,${(0.12 * k).toFixed(3)})`);
      g.addColorStop(1, `rgba(236,238,244,0.02)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    };

    // Clouds are clusters of soft puffs stamped from the mote sprite, so they
    // cost the same as the dust field. Depth drives size, speed and weight.
    const drawClouds = (t: number, near: boolean) => {
      if (!moteSprites.length) return;
      const sprite = moteSprites[0];
      // a clear sky keeps a wisp or two; an overcast one packs them in
      const cover = 0.25 + weather.cloud * 1.15;
      for (const c of clouds) {
        if (near !== c.z >= 0.5) continue;
        if (c.z > weather.cloud * 1.25 + 0.15) continue; // fewer clouds when clear
        const span = width + c.w * 2;
        const x = (((c.x - t * c.speed) % span) + span) % span - c.w;
        const y = c.y + scrollY * (0.04 + c.z * 0.4);
        for (const p of c.puffs) {
          // a touch of vertical breathing keeps the mass from looking rigid
          const bob = Math.sin(t * 0.12 + p.dx * 0.01) * c.h * 0.06;
          ctx.globalAlpha = p.a * (0.6 + c.z * 0.4) * cover;
          ctx.drawImage(
            sprite,
            x + p.dx - p.r,
            y + p.dy + bob - p.r,
            p.r * 2,
            p.r * 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    // Rain. Every drop is a short line; they are all stroked in one path per
    // depth band, so the whole field is a handful of draw calls rather than
    // several hundred. Scrolling lengthens the streaks, reusing the warp idea.
    const drawRain = (dt: number, animate: boolean, gust: number) => {
      // Real conditions drive the field: how much falls, how hard it leans,
      // and whether it falls as snow.
      const amount = weather.rain;
      if (amount <= 0.001) return; // genuinely dry out there - draw nothing
      const snow = weather.snow;
      const tilt = snow
        ? weather.wind * 0.25
        : 0.1 + weather.wind * 0.45 + gust * 0.05;
      const fallScale = snow ? 0.16 : 0.55 + amount * 0.75;
      for (const band of [0, 1, 2]) {
        const lo = band / 3;
        const hi = (band + 1) / 3;
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < rain.length; i++) {
          const d = rain[i];
          if (d.z < lo || d.z >= hi) continue;
          // thin the field by intensity using a fixed per-drop seed, so
          // lighter rain drops drops rather than reshuffling the whole sky
          if (rainSeeds && rainSeeds[i] > amount) continue;
          if (animate) {
            d.y += d.speed * dt * fallScale;
            d.x += d.speed * dt * fallScale * tilt;
            if (snow) d.x += Math.sin(d.y * 0.02 + i) * 14 * dt;
            if (d.y > height + 20) {
              d.y = -20 - Math.random() * height * 0.2;
              d.x = Math.random() * (width + 200) - 100;
            }
            if (d.x > width + 100) d.x -= width + 200;
            if (d.x < -100) d.x += width + 200;
          }
          if (snow) {
            // flakes are specks, not streaks
            ctx.moveTo(d.x + 0.8, d.y);
            ctx.arc(d.x, d.y, 0.8 + d.z * 1.4, 0, Math.PI * 2);
          } else {
            const L = d.len * (0.6 + amount * 0.7) * (1 + gust * 0.9);
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - L * tilt, d.y - L);
          }
          any = true;
        }
        if (!any) continue;
        const z = (lo + hi) / 2;
        if (snow) {
          // a cool mid-tone, so flakes read against bright sky and dark cloud alike
          ctx.fillStyle = `rgba(178,197,224,${(0.5 + z * 0.4).toFixed(3)})`;
          ctx.fill();
        } else {
          ctx.strokeStyle = `rgba(120,140,175,${(0.12 + z * 0.3).toFixed(3)})`;
          ctx.lineWidth = 0.6 + z * 1.0;
          ctx.stroke();
        }
      }
    };

    // --- comets -----------------------------------------------------------
    const spawnComet = () => {
      const fromLeft = Math.random() < 0.5;
      const speed = 190 + Math.random() * 230;
      const ang = 0.18 + Math.random() * 0.45;
      comets.push({
        x: fromLeft ? -80 : width + 80,
        y: Math.random() * height * 0.55,
        vx: (fromLeft ? 1 : -1) * speed * Math.cos(ang),
        vy: speed * Math.sin(ang),
        age: 0,
        life: 2.6 + Math.random() * 2.2,
        len: 90 + Math.random() * 190,
        size: 1.1 + Math.random() * 1.9,
        icy: Math.random() < 0.5,
        wobble: Math.random() * Math.PI * 2,
      });
    };

    const drawComets = (dt: number, animate: boolean) => {
      if (animate && comets.length < 3 && Math.random() < 0.006) spawnComet();

      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        if (animate) {
          c.age += dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
        }
        if (c.age > c.life || c.x < -260 || c.x > width + 260 || c.y > height + 260) {
          comets.splice(i, 1);
          continue;
        }
        // ease in and out at the ends so nothing pops into existence
        const u = c.age / c.life;
        const fade = Math.min(1, u / 0.18) * Math.min(1, (1 - u) / 0.25);
        if (fade <= 0.01) continue;

        const sp = Math.hypot(c.vx, c.vy) || 1;
        const ux = -c.vx / sp; // unit vector pointing back along the trail
        const uy = -c.vy / sp;
        const tailLen = c.len * (0.75 + 0.25 * Math.sin(c.wobble + c.age * 2));
        const tx = c.x + ux * tailLen;
        const ty = c.y + uy * tailLen;

        const core = c.icy ? "214,244,255" : "255,236,190";
        const mid = c.icy ? "120,210,255" : "255,168,74";
        const edge = c.icy ? "70,140,230" : "236,96,52";

        // tail: a tapered wedge, brightest where it leaves the nucleus
        const grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
        grad.addColorStop(0, `rgba(${core},${(0.85 * fade).toFixed(3)})`);
        grad.addColorStop(0.18, `rgba(${mid},${(0.5 * fade).toFixed(3)})`);
        grad.addColorStop(0.55, `rgba(${edge},${(0.16 * fade).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${edge},0)`);
        const px = -uy;
        const py = ux;
        const hw = c.size * 1.7;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(c.x + px * hw, c.y + py * hw);
        ctx.lineTo(tx + px * hw * 0.25, ty + py * hw * 0.25);
        ctx.lineTo(tx - px * hw * 0.25, ty - py * hw * 0.25);
        ctx.lineTo(c.x - px * hw, c.y - py * hw);
        ctx.closePath();
        ctx.fill();

        // coma: the glow packed around the nucleus
        const comaR = c.size * 7;
        const coma = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, comaR);
        coma.addColorStop(0, `rgba(${core},${(0.8 * fade).toFixed(3)})`);
        coma.addColorStop(0.4, `rgba(${mid},${(0.3 * fade).toFixed(3)})`);
        coma.addColorStop(1, `rgba(${mid},0)`);
        ctx.fillStyle = coma;
        ctx.fillRect(c.x - comaR, c.y - comaR, comaR * 2, comaR * 2);

        ctx.fillStyle = `rgba(255,255,255,${(0.95 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.fill();
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
    const LOOP_T = 30; // animation period, seconds
    const STRIDE = 13; // floats per animated texel

    // The disk's waves are sin(a(r) + b(r)t) with b the Keplerian rate, so the
    // pattern's SPATIAL frequency across the disk is a' + b'(r)t - it grows
    // without bound as the page stays open. Past a few minutes it exceeds one
    // cycle per texel and the gas aliases into moire and speckle, which is what
    // made the hole look dead after a tab sat in the background.
    //
    // The cure is to make the animation exactly periodic: quantise every
    // temporal frequency to a whole number of cycles per LOOP_T, then feed in a
    // wrapped time. Nothing can then shear further than it does at t = LOOP_T,
    // and the wrap is seamless because every wave is back where it started.
    const qz = (b: number) => {
      const base = (2 * Math.PI) / LOOP_T;
      const n = Math.round(b / base);
      return (n === 0 ? Math.sign(b) || 1 : n) * base;
    };
    const RING_SHIMMER = qz(6 * RING_OMEGA);

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
        params[o + 3] = qz(2.0 * omega); //    ...temporal frequency
        params[o + 4] = rr * 9.0 + 5 * phi + 1.7; // wave 2
        params[o + 5] = qz(-5.0 * omega);
        params[o + 6] = rr * 2.3 - phi + 0.6; // wave 3
        params[o + 7] = qz(1.1 * omega);
        params[o + 8] = phi; // hot-spot reference azimuth
        params[o + 9] = qz(1.9 * omega); // hot spot 1 rate
        params[o + 12] = qz(3.1 * omega); // hot spot 2 rate
        params[o + 10] = ri;
        params[o + 11] = 3 * ringPhi[p]; // ring shimmer phase
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
      t -= LOOP_T * Math.floor(t / LOOP_T); // bounded: the shear cannot run away
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
          // sharp orbiting hot spots - repeated squaring beats Math.pow here
          const c1 = Math.cos(phi - prm[o + 9] * t);
          const c2 = Math.cos(phi - prm[o + 12] * t + 2.4);
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
        if (ri > 0) E += ri * (0.82 + 0.18 * Math.sin(prm[o + 11] - RING_SHIMMER * t));

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

      // Ambient warmth thrown onto the surrounding space. A two-stop gradient
      // ramps at a constant rate right up to its boundary, so on a dark canvas
      // the tail ends on a visible edge. These stops follow exp(-3u^2) instead:
      // the slope flattens toward zero, and the glow dissolves into the
      // background rather than stopping at a line. The radius is longer for
      // the same reason - a slow tail is what makes it disappear.
      const gr = r * 4.2;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, gr);
      const peak = 0.185 * shimmer;
      for (const [u, f] of [
        [0, 1], [0.12, 0.958], [0.25, 0.829], [0.38, 0.648],
        [0.5, 0.472], [0.65, 0.281], [0.8, 0.147], [0.9, 0.06], [1, 0],
      ]) {
        // cool the hue slightly as it fades, so the tail meets the violet sky
        const g2 = Math.round(170 - 24 * u);
        const b2 = Math.round(90 + 26 * u);
        glow.addColorStop(u, `rgba(255,${g2},${b2},${(peak * f).toFixed(4)})`);
      }
      ctx.fillStyle = glow;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

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

    // The light theme's counterpart. On a near-white canvas you cannot signal
    // brightness with brightness - white on white is invisible, which is why
    // the old pale disc read as faint. Luminosity here comes from saturation,
    // from a limb-darkened photosphere that behaves like an object, and from
    // the star occluding the constellation behind it. The old version's hard
    // 1.4px stroked ring is gone; that was the tell that made it look fake.
    const SUN_FR = 0.065; // radius as a fraction of min(viewport)
    const SUN_FX = 0.8;
    const SUN_FY = 0.22;
    const SUN_DISC = 1.06; // photosphere radius in units of R

    let sunSprite: HTMLCanvasElement | null = null;
    let sunSpriteCtx: CanvasRenderingContext2D | null = null;
    let sunSpriteR = 0;
    let sunT = -1;

    const sunCenter = () => ({
      cx: width * SUN_FX,
      cy: height * SUN_FY,
      r: Math.min(width, height) * SUN_FR,
    });

    // Deterministic value noise - photosphere granulation.
    const vnoise = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const hsh = (a: number, b: number) => {
        let n = (a * 374761393 + b * 668265263) | 0;
        n = (n ^ (n >> 13)) * 1274126177;
        return ((n ^ (n >> 16)) >>> 0) / 4294967296;
      };
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      return (
        hsh(xi, yi) * (1 - u) * (1 - v) + hsh(xi + 1, yi) * u * (1 - v) +
        hsh(xi, yi + 1) * (1 - u) * v + hsh(xi + 1, yi + 1) * u * v
      );
    };

    // Only the photosphere needs per-pixel work, and it is small (~130px
    // across), so it is baked into a sprite and refreshed a few times a
    // second while the granulation churns. The corona is drawn with
    // gradients every frame, which is essentially free.
    const buildSun = (R: number, t: number) => {
      const RD = R * SUN_DISC;
      const size = Math.ceil(2 * RD + 4);
      if (size < 4) return;
      if (!sunSprite || sunSprite.width !== size) {
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        sunSprite = c;
        sunSpriteCtx = c.getContext("2d");
      }
      if (!sunSpriteCtx) return;
      const img = sunSpriteCtx.createImageData(size, size);
      const d = img.data;
      const mid = size / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - mid, dy = y + 0.5 - mid;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > RD + 1.5) continue;
          // antialiased limb
          const e = Math.max(0, Math.min(1, (dist - (RD - 1)) / 2));
          const cov = 1 - e * e * (3 - 2 * e);
          if (cov <= 0.002) continue;
          const u = Math.min(1, dist / RD);
          // classic limb darkening: I/I0 = 1 - eps(1 - mu)
          const mu = Math.sqrt(Math.max(0, 1 - u * u));
          const limb = 1 - 0.62 * (1 - mu);
          const g =
            0.5 * vnoise(dx / (R * 0.16) + t * 0.05, dy / (R * 0.16) - t * 0.04) +
            0.5 * vnoise(dx / (R * 0.07) - t * 0.09, dy / (R * 0.07) + t * 0.06);
          const shade = limb * (0.93 + 0.14 * (g - 0.5));
          const k = Math.pow(shade, 0.95);
          const q = (y * size + x) * 4;
          d[q] = 255;
          d[q + 1] = 150 + 105 * k;
          d[q + 2] = 40 + 200 * Math.pow(k, 2.6);
          d[q + 3] = Math.round(Math.min(1, cov * (0.9 + 0.1 * k)) * 255);
        }
      }
      sunSpriteCtx.putImageData(img, 0, 0);
      sunSpriteR = R;
    };

    const drawSun = (t: number) => {
      const { cx, cy, r } = sunCenter();
      const breathe = 0.97 + 0.03 * Math.sin(t * 0.6);
      const R = r * breathe;
      const RC = R * 5.2;

      // Corona: a tight collar plus a wide bloom, both saturated enough to
      // register against #f5f7fc.
      const collar = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.9);
      collar.addColorStop(0, `rgba(255,214,190,${0.5 * breathe})`);
      collar.addColorStop(0.45, `rgba(255,196,132,${0.2 * breathe})`);
      collar.addColorStop(1, "rgba(255,186,110,0)");
      ctx.fillStyle = collar;
      ctx.fillRect(cx - R * 1.9, cy - R * 1.9, R * 3.8, R * 3.8);

      const bloom = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, RC);
      bloom.addColorStop(0, `rgba(255,190,120,${0.30 * breathe})`);
      bloom.addColorStop(0.35, `rgba(253,186,116,${0.12 * breathe})`);
      bloom.addColorStop(1, "rgba(251,191,120,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(cx - RC, cy - RC, RC * 2, RC * 2);

      // Streamers: soft wedges that drift, so the corona is never a perfect
      // circle. Cheap - a handful of gradient-filled triangles.
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + t * 0.05 + Math.sin(i * 2.3) * 0.4;
        const len = RC * (0.55 + 0.3 * (0.5 + 0.5 * Math.sin(i * 1.7 + t * 0.13)));
        const halfA = 0.16 + 0.07 * Math.sin(i * 3.1 + t * 0.09);
        const gr = ctx.createRadialGradient(0, 0, R, 0, 0, len);
        gr.addColorStop(0, `rgba(255,201,140,${0.13 * breathe})`);
        gr.addColorStop(1, "rgba(255,201,140,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len, ang - halfA, ang + halfA);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // A whisper of diffraction, well short of a hard lens-flare cross.
      for (const [ang, len, wid, amp] of [
        [0, 2.9, 0.30, 0.085],
        [Math.PI / 2, 2.2, 0.26, 0.055],
        [Math.PI, 2.9, 0.30, 0.085],
        [-Math.PI / 2, 2.2, 0.26, 0.055],
      ]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        const L = R * len;
        const gr = ctx.createLinearGradient(R * 0.9, 0, L, 0);
        gr.addColorStop(0, `rgba(255,214,150,${amp * breathe})`);
        gr.addColorStop(1, "rgba(255,214,150,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(R * 0.9, -R * wid * 0.35);
        ctx.lineTo(L, -R * wid);
        ctx.lineTo(L, R * wid);
        ctx.lineTo(R * 0.9, R * wid * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Photosphere. Rebuilt a few times a second so the granulation churns;
      // blitted every frame.
      if (!sunSprite || Math.abs(R - sunSpriteR) > R * 0.06 || sunT < 0 || Math.abs(t - sunT) > 0.12) {
        buildSun(R, t);
        sunT = t;
      }
      if (sunSprite) {
        const half = sunSprite.width / 2;
        ctx.drawImage(sunSprite, cx - half, cy - half);
      }
    };
    const drawFrame = (animate: boolean, t: number) => {
      ctx.clearRect(0, 0, width, height);
      const light = isLight();
      // clamped so a backgrounded tab returning does not teleport anything
      const dt = prevT < 0 ? 0.016 : Math.min(0.05, Math.max(0, t - prevT));
      prevT = t;

      // warp factor follows scroll velocity, easing back to rest
      if (animate) {
        const target = Math.min(scrollAccum * 0.6, 36);
        scrollAccum = 0;
        warp += (target - warp) * 0.16;
        if (warp < 0.05) warp = 0;
      }

      buildMotes(light);
      if (light) ensureWeather();
      if (light) {
        // Overcast sky: wash, then the sun diffused behind the cloud deck,
        // then far cloud. Near cloud goes on after the rain so some of the
        // weather falls behind it.
        drawOvercast();
        // dimmed hard: through cloud this should read as a bright patch of
        // sky rather than a disc with a limb
        ctx.globalAlpha = 0.32 + (1 - weather.cloud) * 0.6;
        drawSun(t);
        ctx.globalAlpha = 1;
        drawClouds(t, false);
      } else {
        drawNebulae(t, light);
        drawHaze(light);
        drawDust(t, false); // far motes sit behind everything
        drawBlackHole(t);
      }

      const rgb = light ? "55,48,163" : "226,238,255";
      const maxAlpha = light ? 0.55 : 0.85;
      const warpCx = width / 2;
      const warpCy = height * 0.45;
      const maxDist = Math.hypot(warpCx, warpCy);
      // stars vanish behind the event horizon (dark theme only)
      const bhX = width * BH.fx;
      const bhY = height * BH.fy;
      const bhR = Math.min(width, height) * BH.fr;
      // Parallax: a star's drawn y is offset by the scroll position scaled by
      // its depth, so near stars sweep past while the far field barely moves.
      // Everything that positions a star must go through this, or the
      // constellation lines detach from their endpoints.
      const starY = (st: Star) => {
        const y = st.y + scrollY * (0.08 + st.z * 0.55);
        return ((y % height) + height) % height;
      };
      // the light theme's occluder
      const sunX = width * SUN_FX;
      const sunY = height * SUN_FY;
      const sunR = Math.min(width, height) * SUN_FR * SUN_DISC;

      // The light theme has no stars any more - it is weather, not space.
      for (const s of light ? [] : stars) {
        if (animate) {
          s.twinkle += s.twinkleSpeed;
          s.x -= s.drift;
          if (s.x < -2) s.x = width + 2;
        }
        const sy = starY(s);
        if (!light && Math.hypot(s.x - bhX, sy - bhY) < bhR) continue;
        if (light && Math.hypot(s.x - sunX, sy - sunY) < sunR) continue;
        // depth also dims: the far field is fainter as well as smaller
        const depthA = 0.34 + s.z * 0.66;
        const alpha = maxAlpha * depthA * (0.35 + 0.65 * Math.abs(Math.sin(s.twinkle)));

        if (warp > 0.5) {
          // stretch into a streak radiating from the warp center
          const dx = s.x - warpCx;
          const dy = sy - warpCy;
          const d = Math.max(Math.hypot(dx, dy), 1);
          const len = warp * (0.3 + d / maxDist) * (s.r * 2.2);
          ctx.strokeStyle = `rgba(${rgb},${alpha})`;
          ctx.lineWidth = s.r;
          ctx.beginPath();
          ctx.moveTo(s.x, sy);
          ctx.lineTo(s.x + (dx / d) * len, sy + (dy / d) * len);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, sy, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${alpha})`;
          ctx.fill();
        }
      }

      if (!light) drawDust(t, true); // near motes drift in front of the stars

      if (light) {
        const gust = Math.min(1, warp / 14); // scrolling stretches the streaks
        drawRain(dt, animate, gust);
        drawClouds(t, true);
        drawHaze(light);
      } else if (FEATURES.comets) {
        drawComets(dt, animate);
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

