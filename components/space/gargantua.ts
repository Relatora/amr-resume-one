// Geometry of the black hole's accretion disk, traced once on the CPU.
//
// A miniature general-relativity ray tracer: for each texel a light ray is
// marched backward past the hole under Schwarzschild deflection
// (a = -1.5 h² x / r⁵ in geometrized units). Rays that strike the disk plane
// record where they hit (radius, azimuth) and how bright the gas there
// looks from here (emissivity falloff and Doppler beaming). The shader
// animates the gas from these maps every frame; the shadow and photon ring
// are analytic in the shader, so they are sharp at any resolution.
//
// Pure maths with no DOM, so it runs in a Web Worker (trace.worker.ts).

export const G = {
  B_CRIT: 2.6, // sprite scale: shadow radius on screen, in units of M
  B_SHADOW: 2.568, // measured capture radius of this integrator
  R_IN: 3.0, // disk inner edge (units of M)
  R_OUT: 8.5, // disk outer edge
  TILT: 0.06, // camera elevation above the disk plane (radians)
  ROLL: -0.09, // cinematic lean applied on screen
  HW: 9.6, // traced region half-width, geometrized units
  HH: 5.2, // traced region half-height
  BASE_CLAMP: 5.0, // outlier ceiling for grazing rays at the rim
};

// Returns w*h RGBA floats per texel: disk brightness, hit radius, and the
// hit azimuth as cos/sin (so bilinear filtering never blends across the
// -pi/pi seam). Zero brightness means the ray missed the disk.
export function traceDisk(w: number, h: number): Float32Array {
  const { B_SHADOW, R_IN, R_OUT, TILT, HW, HH, BASE_CLAMP } = G;
  const n = w * h;
  const base = new Float32Array(n);
  const out = new Float32Array(n * 4);
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  const px = (2 * HW) / w; // world units per texel

  for (let j = 0; j < h; j++) {
    const sy = HH - (j + 0.5) * px;
    for (let i = 0; i < w; i++) {
      const sx = (i + 0.5) * px - HW;
      const h2 = sx * sx + sy * sy; // conserved angular momentum²
      if (h2 > 88) continue; // too far out for any light path to the disk
      const b = Math.sqrt(h2);
      const p = j * w + i;

      // The near-side band crossing the hole's face is only a few texels
      // thick; supersample there so its edge does not alias into specks.
      const sub = b < B_SHADOW + 0.12 ? 3 : 1;
      let acc = 0;
      let best = -1;
      let bestR = 0;
      let bestPhi = 0;

      for (let sj = 0; sj < sub; sj++) {
        for (let si = 0; si < sub; si++) {
          const ox = sub === 1 ? 0 : ((si + 0.5) / sub - 0.5) * px;
          const oy = sub === 1 ? 0 : ((sj + 0.5) / sub - 0.5) * px;
          const rx = sx + ox;
          const ry = sy - oy;
          const rh2 = rx * rx + ry * ry;

          let x = rx, y = ry, z = 10;
          let vx = 0, vy = 0, vz = -1;
          let side = y * cosT + z * sinT;
          // The crossing in FRONT of the hole happens while the ray is
          // still falling inward; after periapsis it has wrapped behind.
          let receding = false;
          let prevR = Infinity;

          for (let st = 0; st < 520; st++) {
            const r2 = x * x + y * y + z * z;
            const r1 = Math.sqrt(r2);
            if (r1 > prevR) receding = true;
            prevR = r1;
            if (r2 < 1) break; // fell through the horizon
            const f = (-1.5 * rh2) / (r2 * r2 * r1);
            const dt = Math.min(0.2, Math.max(0.02, 0.045 * r1));
            vx += f * x * dt; vy += f * y * dt; vz += f * z * dt;
            const x0 = x, y0 = y, z0 = z;
            x += vx * dt; y += vy * dt; z += vz * dt;

            const sideN = y * cosT + z * sinT;
            if (side * sideN < 0) {
              const k = side / (side - sideN);
              const hx = x0 + (x - x0) * k;
              const hy = y0 + (y - y0) * k;
              const hz = z0 + (z - z0) * k;
              const rr = Math.sqrt(hx * hx + hy * hy + hz * hz);
              if (rr >= R_IN && rr <= R_OUT) {
                if (!(b < B_SHADOW + 0.5 && receding)) {
                  let v = Math.pow(R_IN / rr, 2.2) * 1.7;
                  v *= Math.min(1, (R_OUT - rr) / 1.4); // outer fade
                  v *= Math.min(1, (rr - R_IN) / 0.25 + 0.15); // inner edge
                  // Doppler beaming: the orbit tangent's line-of-sight part
                  const dz = (-cosT * hx) / rr;
                  const beta = 0.5 * Math.sqrt(R_IN / rr);
                  const dopp = 1 / (1 - beta * dz);
                  v *= dopp * dopp * dopp;
                  acc += v;
                  if (v > best) { best = v; bestR = rr; bestPhi = Math.atan2(hz, hx); }
                }
                break;
              }
            }
            side = sideN;
            if (r2 > 180 || (z < -11 && vz < 0)) break; // escaped
          }
        }
      }

      if (best > 0) {
        // the full sample count, not the hit count: a partly covered texel
        // is genuinely dimmer, which is the anti-aliasing
        base[p] = acc / (sub * sub);
        out[p * 4 + 1] = bestR;
        out[p * 4 + 2] = Math.cos(bestPhi);
        out[p * 4 + 3] = Math.sin(bestPhi);
      }
    }
  }

  // Mean-filter the rim band: grazing rays there still span a huge dynamic
  // range, and a 3x3 mean turns the grain into the gradient it really is.
  const src = base.slice();
  for (let j = 1; j < h - 1; j++) {
    const sy = HH - (j + 0.5) * px;
    for (let i = 1; i < w - 1; i++) {
      const sx = (i + 0.5) * px - HW;
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
      if (cnt) base[p] = sum / cnt;
    }
  }
  for (let p = 0; p < n; p++) out[p * 4] = base[p];
  return out;
}

// Texture size for a shadow of `rPx` CSS pixels at device ratio `dpr`,
// capped so the one-off trace stays around a second in the worker.
export function mapSize(rPx: number, dpr: number) {
  const unit = (rPx / G.B_CRIT) * Math.min(dpr, 2);
  let w = Math.ceil(2 * G.HW * unit);
  const cap = 1800;
  if (w > cap) w = cap;
  const h = Math.round((w * G.HH) / G.HW);
  return { w, h };
}
