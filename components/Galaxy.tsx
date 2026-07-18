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
  { fx: 0.18, fy: 0.28, fr: 0.55, dark: "45,212,191", light: "13,148,136", phase: 0, speed: 0.05 },
  { fx: 0.85, fy: 0.65, fr: 0.6, dark: "139,92,246", light: "124,58,237", phase: 2.1, speed: 0.04 },
  { fx: 0.5, fy: 0.95, fr: 0.5, dark: "244,114,182", light: "251,146,60", phase: 4.2, speed: 0.06 },
];

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
      width = window.innerWidth;
      height = window.innerHeight;
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
        const alpha = light ? 0.09 : 0.13;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${rgb},${alpha})`);
        grad.addColorStop(0.6, `rgba(${rgb},${alpha * 0.45})`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    };

    // Gargantua: glow → tilted accretion disk (back half) → event horizon →
    // photon ring → disk front half, with a slow shimmer.
    const drawBlackHole = (t: number) => {
      const cx = width * 0.8;
      const cy = height * 0.24;
      const r = Math.min(width, height) * 0.055;
      const shimmer = 0.85 + 0.15 * Math.sin(t * 0.8);

      const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 3.4);
      glow.addColorStop(0, `rgba(255,176,96,${0.22 * shimmer})`);
      glow.addColorStop(0.5, `rgba(255,140,80,${0.08 * shimmer})`);
      glow.addColorStop(1, "rgba(255,140,80,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r * 3.4, cy - r * 3.4, r * 6.8, r * 6.8);

      const diskHalf = (half: "back" | "front") => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.22);
        ctx.scale(1, 0.24);
        const disk = ctx.createRadialGradient(0, 0, r * 1.05, 0, 0, r * 2.6);
        disk.addColorStop(0, `rgba(255,214,140,${0.85 * shimmer})`);
        disk.addColorStop(0.4, `rgba(255,170,90,${0.5 * shimmer})`);
        disk.addColorStop(1, "rgba(255,140,80,0)");
        ctx.fillStyle = disk;
        ctx.beginPath();
        if (half === "back") ctx.arc(0, 0, r * 2.6, Math.PI, 2 * Math.PI);
        else ctx.arc(0, 0, r * 2.6, 0, Math.PI);
        ctx.arc(0, 0, r * 1.02, half === "back" ? 2 * Math.PI : Math.PI, half === "back" ? Math.PI : 0, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      diskHalf("back");

      // lensed halo above/below the horizon
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.42, 1);
      ctx.strokeStyle = `rgba(255,200,130,${0.28 * shimmer})`;
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // event horizon
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // photon ring
      ctx.strokeStyle = `rgba(255,236,200,${0.9 * shimmer})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
      ctx.stroke();

      diskHalf("front");
    };

    // The light theme's counterpart: a soft sun with a halo.
    const drawSun = (t: number) => {
      const cx = width * 0.8;
      const cy = height * 0.22;
      const r = Math.min(width, height) * 0.05;
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
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

