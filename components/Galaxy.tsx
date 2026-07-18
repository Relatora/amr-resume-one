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

// Full-viewport animated starfield behind the whole site.
// Bright twinkling stars + occasional shooting star in dark mode,
// faint slate stars in light mode. Static single frame if the user
// prefers reduced motion.
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
    let shooting: ShootingStar | null = null;
    let raf = 0;

    const isLight = () => document.documentElement.classList.contains("light");

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
    };

    const drawFrame = (animate: boolean) => {
      ctx.clearRect(0, 0, width, height);
      const light = isLight();
      const rgb = light ? "51,65,85" : "226,238,255";
      const maxAlpha = light ? 0.28 : 0.85;

      for (const s of stars) {
        if (animate) {
          s.twinkle += s.twinkleSpeed;
          s.x -= s.drift;
          if (s.x < -2) s.x = width + 2;
        }
        const alpha = maxAlpha * (0.35 + 0.65 * Math.abs(Math.sin(s.twinkle)));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${alpha})`;
        ctx.fill();
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

    const loop = () => {
      drawFrame(true);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);

    // Re-render the static frame on theme change when not animating.
    const observer = new MutationObserver(() => {
      if (reduced) drawFrame(false);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (reduced) {
      drawFrame(false);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* soft nebulae drifting behind the stars */}
      <div className="absolute -top-48 right-[-12%] h-[42rem] w-[42rem] rounded-full bg-violet-500/10 blur-3xl animate-blob-slow" />
      <div className="absolute bottom-[-22%] left-[-12%] h-[38rem] w-[38rem] rounded-full bg-teal-500/10 blur-3xl animate-blob" />
      <div className="absolute top-1/3 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-3xl animate-blob-slow" />
    </div>
  );
}
