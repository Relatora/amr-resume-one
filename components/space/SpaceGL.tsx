"use client";

import { useEffect, useRef } from "react";
import { GAS_FRAG, SKY_FRAG, VERT } from "./shaders";
import { mapSize, traceDisk } from "./gargantua";
import { SPACE_FEATURES as F } from "./flags";

// The dark theme's sky on the GPU: stars, the Milky Way, nebula gas and the
// black hole in one WebGL2 scene, so the hole can lens everything behind
// it. The disk geometry is ray-traced once in a worker (gargantua.ts) and
// uploaded as a texture; the shaders (shaders.ts) do the per-frame work.
//
// Calls onFail when WebGL2 is missing, a shader will not compile, or the
// GPU context is lost, so the page falls back to the canvas galaxy.

// Black hole placement: viewport fractions, the same as the canvas version.
const BH = { fx: 0.78, fy: 0.3, fr: 0.11 };
const GAS_DOWNSCALE = 4; // gas pass renders at a quarter of CSS resolution

// The sense of flight: the page drifts forward through the stars on its
// own, scrolling down flies faster (scrolling up eases back), and the sky
// rolls slowly about the centre of the screen.
const CRUISE = 0.018; // star-layer cycles per second at rest
const SCROLL_THRUST = 0.00006; // cycles per pixel scrolled
const ROLL_RATE = 0.012; // radians per second, about one turn in 9 minutes
const ROLL_SCROLL = 0.00003; // extra roll per pixel scrolled
const MAX_DPR = 2;


function compile(gl: WebGL2RenderingContext, vs: string, fs: string, label: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      const why = gl.isContextLost() ? "context lost" : gl.getShaderInfoLog(s) || "no info log";
      throw new Error(`${label} ${kind} shader: ${why}`);
    }
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`${label} link: ${gl.getProgramInfoLog(prog) || "no info log"}`);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(prog, name));
    return uniforms.get(name)!;
  };
  return { prog, u };
}

export default function SpaceGL({ onFail }: { onFail: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return onFail();

    let gas: ReturnType<typeof compile>;
    let sky: ReturnType<typeof compile>;
    try {
      gas = compile(gl, VERT, GAS_FRAG, "gas");
      sky = compile(gl, VERT, SKY_FRAG, "sky");
    } catch (err) {
      console.error("Space shaders failed, using the canvas galaxy:", err);
      return onFail();
    }

    // One triangle that covers the screen.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const makeTex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const gasTex = makeTex();
    const gasFbo = gl.createFramebuffer();
    const mapTex = makeTex();
    let mapReady = false;

    // ---- sizing ------------------------------------------------------------
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let quality = 1; // drops on slow GPUs, see the frame timer below
    let cssW = 0, cssH = 0, dpr = 1, gasW = 0, gasH = 0;
    const resize = () => {
      cssW = canvas.clientWidth || window.innerWidth;
      cssH = canvas.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * quality;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      gasW = Math.ceil(cssW / GAS_DOWNSCALE);
      gasH = Math.ceil(cssH / GAS_DOWNSCALE);
      gl.bindTexture(gl.TEXTURE_2D, gasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gasW, gasH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, gasFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gasTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      requestTrace();
      if (reduced) draw(0);
    };

    // ---- disk trace --------------------------------------------------------
    // A quick low-resolution trace first so the hole appears at once, then a
    // full-resolution one replaces it when the worker finishes.
    let worker: Worker | null = null;
    let traceId = 0;
    let tracedFor = 0; // shadow radius the current map was traced at
    const upload = (w: number, h: number, data: Float32Array) => {
      gl.bindTexture(gl.TEXTURE_2D, mapTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data);
      mapReady = true;
      if (reduced) draw(0);
    };
    try {
      worker = new Worker(new URL("./trace.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<{ id: number; w: number; h: number; data: Float32Array }>) => {
        if (e.data.id >= traceId - 1) upload(e.data.w, e.data.h, e.data.data);
      };
    } catch {
      worker = null; // no worker support: trace on the main thread, small
    }
    const requestTrace = () => {
      const R = Math.min(cssW, cssH) * BH.fr;
      if (tracedFor && R < tracedFor * 1.3 && R > tracedFor * 0.6) return;
      tracedFor = R;
      const quick = mapSize(R, 0.6);
      const full = mapSize(R, window.devicePixelRatio || 1);
      if (worker) {
        worker.postMessage({ id: ++traceId, ...quick });
        worker.postMessage({ id: ++traceId, ...full });
      } else {
        setTimeout(() => upload(quick.w, quick.h, traceDisk(quick.w, quick.h)), 0);
      }
    };

    // ---- scroll ------------------------------------------------------------
    let scrollY = window.scrollY;
    let lastY = scrollY;
    let vel = 0;
    // Flight state, accumulated each frame. Travel wraps at whole cycles,
    // which the shader cannot tell apart; roll wraps at a full turn.
    let travel = 0;
    let roll = 0;
    let lastT = -1;
    const onScroll = () => {
      scrollY = window.scrollY;
      if (reduced) draw(0);
    };

    // ---- drawing -----------------------------------------------------------
    const isLight = () => document.documentElement.classList.contains("light");
    const draw = (t: number) => {
      if (isLight()) return;
      // Eased scroll speed for the star streaks, and the flight itself.
      // Reduced motion keeps the sky still.
      if (!reduced) {
        const dy = scrollY - lastY;
        const dt = lastT < 0 ? 0 : Math.min(0.05, Math.max(0, t - lastT)); // no jump after a hidden tab
        lastT = t;
        vel += (Math.min(3, Math.abs(dy) * 0.05) - vel) * 0.15;
        travel = (((travel + CRUISE * dt + dy * SCROLL_THRUST) % 1) + 1) % 1; // a big scroll up stays in [0, 1)
        roll = (roll + ROLL_RATE * dt + dy * ROLL_SCROLL) % (Math.PI * 2);
        lastY = scrollY;
      }

      // Pass 1: gas into the small framebuffer.
      gl.bindFramebuffer(gl.FRAMEBUFFER, gasFbo);
      gl.viewport(0, 0, gasW, gasH);
      gl.useProgram(gas.prog);
      gl.uniform2f(gas.u("uView"), cssW, cssH);
      gl.uniform1f(gas.u("uScale"), GAS_DOWNSCALE);
      gl.uniform1f(gas.u("uTime"), t);
      gl.uniform1f(gas.u("uScroll"), scrollY);
      gl.uniform1f(gas.u("uRoll"), roll);
      gl.uniform1f(gas.u("uNebula"), F.nebula ? 1 : 0);
      gl.uniform1f(gas.u("uMilky"), F.milkyWay ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 2: the sky, at full resolution.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(sky.prog);
      gl.uniform2f(sky.u("uView"), cssW, cssH);
      gl.uniform1f(sky.u("uDpr"), dpr);
      gl.uniform1f(sky.u("uTime"), t);
      gl.uniform1f(sky.u("uScroll"), scrollY);
      gl.uniform1f(sky.u("uVel"), reduced ? 0 : vel);
      gl.uniform1f(sky.u("uTravel"), travel);
      gl.uniform1f(sky.u("uRoll"), roll);
      gl.uniform3f(sky.u("uBH"), cssW * BH.fx, cssH * BH.fy, Math.min(cssW, cssH) * BH.fr);
      gl.uniform1f(sky.u("uStars"), F.stars ? 1 : 0);
      gl.uniform1f(sky.u("uMilky"), F.milkyWay ? 1 : 0);
      gl.uniform1f(sky.u("uHole"), F.hole ? 1 : 0);
      gl.uniform1f(sky.u("uLens"), F.lensing ? 1 : 0);
      gl.uniform1f(sky.u("uMapReady"), mapReady ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gasTex);
      gl.uniform1i(sky.u("uGas"), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, mapTex);
      gl.uniform1i(sky.u("uMap"), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // Frame loop with a simple quality governor: if frames run long for a
    // couple of seconds, render at a lower pixel ratio rather than stutter.
    let raf = 0;
    let frames = 0;
    let slow = 0;
    let lastFrame = performance.now();
    let fpsWindow = lastFrame;
    const loop = (now: number) => {
      const dt = now - lastFrame;
      lastFrame = now;
      draw(now / 1000);
      frames++;
      if (dt > 26 && dt < 200) slow++;
      if (now - fpsWindow > 1000) {
        if (slow > frames * 0.5 && quality > 0.5) {
          quality = Math.max(0.5, quality * 0.8);
          resize();
        }
        frames = 0;
        slow = 0;
        fpsWindow = now;
      }
      raf = requestAnimationFrame(loop);
    };

    // Pause entirely while the light theme is showing.
    const onTheme = () => {
      if (isLight()) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !reduced) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (reduced) {
        draw(0);
      }
    };
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onLost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });

    resize();
    if (reduced) draw(0);
    else onTheme();

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      worker?.terminate();
      // Free the GPU objects but keep the context: a canvas always returns
      // the same context, so losing it here would break the next mount
      // (React mounts effects twice in development).
      gl.deleteTexture(gasTex);
      gl.deleteTexture(mapTex);
      gl.deleteFramebuffer(gasFbo);
      gl.deleteBuffer(buf);
      gl.deleteProgram(gas.prog);
      gl.deleteProgram(sky.prog);
    };
  }, [onFail]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 [.light_&]:hidden">
      {/* w/h-full is required: without CSS size a canvas renders at its
          pixel size and overflows on HiDPI displays */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
