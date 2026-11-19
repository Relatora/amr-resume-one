"use client";

import { useEffect, useRef } from "react";

// Shooting stars for the dark theme: every few seconds a meteor streaks
// down across the upper sky, a bright head with a tapering tail that burns
// out. A separate small 2D canvas over the GPU sky, since meteors are
// short-lived objects with state, which a stateless shader handles poorly.
// Skipped entirely for reduced motion.

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  len: number;
  width: number;
  tint: string;
}

const TINTS = ["255,244,220", "210,232,255", "255,226,190"];

export default function ShootingStars() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const meteors: Meteor[] = [];
    let next = 2.5; // seconds until the next one
    const spawn = () => {
      const speed = 900 + Math.random() * 700;
      const ang = 0.35 + Math.random() * 0.4; // falling, leaning left
      meteors.push({
        x: w * (0.25 + Math.random() * 0.8),
        y: h * Math.random() * 0.35,
        vx: -Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        age: 0,
        life: 0.55 + Math.random() * 0.6,
        len: 120 + Math.random() * 160,
        width: 1.2 + Math.random() * 1.3,
        tint: TINTS[Math.floor(Math.random() * TINTS.length)],
      });
      next = 3.5 + Math.random() * 8;
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (!document.documentElement.classList.contains("light")) {
        next -= dt;
        if (next <= 0) spawn();
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.age += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.age > m.life) {
          meteors.splice(i, 1);
          continue;
        }
        // flare up quickly, burn out slowly
        const u = m.age / m.life;
        const a = Math.min(1, u / 0.12) * Math.pow(1 - u, 1.4);
        const sp = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / sp) * m.len;
        const ty = m.y - (m.vy / sp) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(${m.tint},${(0.95 * a).toFixed(3)})`);
        g.addColorStop(0.25, `rgba(${m.tint},${(0.35 * a).toFixed(3)})`);
        g.addColorStop(1, `rgba(${m.tint},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = m.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        // the glowing head
        const r = m.width * 3.5;
        const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        hg.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
        hg.addColorStop(1, `rgba(${m.tint},0)`);
        ctx.fillStyle = hg;
        ctx.fillRect(m.x - r, m.y - r, r * 2, r * 2);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 [.light_&]:hidden">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
