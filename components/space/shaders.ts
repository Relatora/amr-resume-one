import { G } from "./gargantua";

// GLSL for the dark-theme sky. Two passes:
//
// 1. GAS_FRAG, at a quarter resolution: the soft things, nebula clouds and
//    the Milky Way's glow. Domain-warped noise is the expensive part of the
//    scene and it has no fine detail, so it is rendered small and filtered
//    up.
// 2. SKY_FRAG, at full resolution: stars (analytic, so crisp at any pixel
//    ratio), the gas texture, and the black hole. Everything behind the
//    hole is looked up through a gravitational lens, so stars and gas bend
//    into arcs around it.
//
// Output is premultiplied and mostly additive: light is added on top of the
// page's dark background (and the faint sky keywords under it); only the
// hole's shadow is opaque.

const COMMON = /* glsl */ `#version 300 es
precision highp float;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = ROT * p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

// The Milky Way: a band crossing the screen at a slight rise, in CSS px.
// Returns how deep inside the band a point is (0..1) and, in .y, how close
// it is to the dark dust lane running down its middle.
vec2 band(vec2 q, vec2 view) {
  vec2 c = vec2(0.42, 0.58) * view;
  float a = -0.42;
  vec2 d = q - c;
  float v = -sin(a) * d.x + cos(a) * d.y; // distance across the band
  float u = cos(a) * d.x + sin(a) * d.y;  // distance along it
  float wobble = (fbm(vec2(u * 0.004, 3.1)) - 0.5) * 0.12 * view.y;
  float sigma = 0.16 * view.y;
  float inside = exp(-pow(v - wobble, 2.0) / (2.0 * sigma * sigma));
  float laneW = 0.028 * view.y;
  float lane = exp(-pow(v - wobble * 0.6 + (fbm(vec2(u * 0.01, 7.3)) - 0.5) * 0.05 * view.y, 2.0) / (2.0 * laneW * laneW));
  return vec2(inside, lane);
}
`;

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const GAS_FRAG = /* glsl */ `${COMMON}
uniform vec2 uView;     // viewport, CSS px
uniform float uScale;   // CSS px per gas texel
uniform float uTime;
uniform float uScroll;  // page scroll, CSS px
uniform float uRoll;    // slow roll of the whole sky, radians
uniform float uNebula;  // 0/1 toggles
uniform float uMilky;
out vec4 frag;

void main() {
  vec2 p = vec2(gl_FragCoord.x, (uView.y / uScale) - gl_FragCoord.y) * uScale;
  // the sky rolls about the screen centre (the stars do the same)
  p = uView * 0.5 + rot(p - uView * 0.5, -uRoll);
  vec3 col = vec3(0.0);

  if (uNebula > 0.5) {
    // Domain-warped fbm: the warp is what turns blobs into filaments.
    vec2 q = (p + vec2(uTime * 2.0, uScroll * 0.08)) / 520.0;
    vec2 warp = vec2(fbm(q * 1.6 + 1.7), fbm(q * 1.6 + 9.2));
    float n = fbm(q + 1.8 * warp);
    float wisps = smoothstep(0.42, 0.9, n);
    float hue = fbm(q * 0.55 + 4.0);
    vec3 teal = vec3(0.10, 0.72, 0.66);
    vec3 violet = vec3(0.48, 0.30, 0.95);
    vec3 magenta = vec3(0.92, 0.32, 0.62);
    vec3 tint = mix(teal, violet, smoothstep(0.32, 0.55, hue));
    tint = mix(tint, magenta, smoothstep(0.58, 0.78, hue));
    // brighter cores along the filaments
    float core = pow(smoothstep(0.6, 0.95, n), 2.0);
    col += tint * (wisps * 0.13 + core * 0.10);
  }

  if (uMilky > 0.5) {
    vec2 q = p + vec2(0.0, uScroll * 0.05);
    vec2 b = band(q, uView);
    float grain = 0.55 + 0.9 * fbm(q * 0.006);
    float glow = b.x * grain * (1.0 - 0.85 * b.y);
    col += vec3(0.62, 0.68, 0.92) * glow * 0.07;
  }

  frag = vec4(col, 1.0);
}
`;

const g = (v: number) => v.toFixed(4);

export const SKY_FRAG = /* glsl */ `${COMMON}
uniform vec2 uView;      // viewport, CSS px
uniform float uDpr;      // device px per CSS px for this canvas
uniform float uTime;
uniform float uScroll;
uniform float uVel;      // smoothed scroll speed, stretches stars
uniform float uTravel;   // distance flown, in star-layer cycles
uniform float uRoll;     // slow roll of the whole sky, radians
uniform vec3 uBH;        // centre x, y and shadow radius, CSS px
uniform float uStars, uMilky, uHole, uLens, uMapReady;
uniform sampler2D uGas;  // pass 1
uniform sampler2D uMap;  // traced disk geometry
out vec4 frag;

const float B_CRIT = ${g(G.B_CRIT)};
const float B_SHADOW = ${g(G.B_SHADOW)};
const float R_IN = ${g(G.R_IN)};
const float TILT = ${g(G.TILT)};
const float ROLL = ${g(G.ROLL)};
const float HW = ${g(G.HW)};
const float HH = ${g(G.HH)};
const float FLOW = 24.0; // seconds per flow cycle (see below)

// Black-body-ish star colour, cool red through white to hot blue.
vec3 starTint(float t) {
  vec3 c = mix(vec3(1.0, 0.62, 0.42), vec3(1.0, 0.86, 0.66), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(1.0, 0.98, 0.95), smoothstep(0.3, 0.6, t));
  return mix(c, vec3(0.68, 0.80, 1.0), smoothstep(0.62, 1.0, t));
}

// One layer of stars on a jittered grid. Most are faint; a power law on
// the magnitude makes a few bright. The brightest get a halo and, when
// spikes > 0, the four-point diffraction cross of a telescope image.
// p is in the layer's own space; zoom maps it to screen pixels (a layer
// flying toward the viewer spreads its stars apart), and fast scrolling
// streaks each star along rdir, the direction of travel on screen.
vec3 stars(vec2 p, float cell, float dens, float seed, float gain, float spikes, float zoom, vec2 rdir) {
  vec3 acc = vec3(0.0);
  vec2 g0 = floor(p / cell);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = g0 + vec2(float(i), float(j));
      vec3 h = hash32(c + seed);
      if (h.x > dens) continue;
      vec2 pos = (c + 0.1 + 0.8 * h.yz) * cell;
      vec2 d = (p - pos) * zoom;
      float along = dot(d, rdir);
      d += rdir * (along / (1.0 + uVel) - along); // motion streak
      float m = hash12(c * 1.37 + seed);
      float I = gain * (0.08 + 1.4 * pow(m, 7.0));
      // scintillation: small, fast, different for every star
      I *= 0.78 + 0.22 * sin(uTime * (1.3 + 3.7 * h.y) + h.z * 6.283);
      float s = (0.42 + 0.9 * pow(m, 3.0)) * (1.0 + 0.16 * log2(zoom)); // nearer, larger
      float r2 = dot(d, d);
      float v = exp(-r2 / (s * s));
      if (m > 0.75) v += 0.06 * exp(-sqrt(r2) / (2.0 + 5.0 * m));
      if (spikes > 0.0 && m > 0.94) {
        float L = exp(-sqrt(r2) / 26.0);
        v += 0.35 * L * (exp(-abs(d.x) * 1.4 - abs(d.y) * 0.05) + exp(-abs(d.y) * 1.4 - abs(d.x) * 0.05));
      }
      acc += starTint(hash12(c + seed * 3.1)) * I * v;
    }
  }
  return acc;
}

// Forward flight. Star layers stream outward from a vanishing point at the
// screen centre, each looping from far (dense, faint, slow) to near (sparse,
// bright, fast) and fading at both ends, so the loop never shows. uTravel
// moves them along; uRoll turns the whole sky slowly about the same point.
// Each pass through the loop reseeds a layer, so the stars never repeat.
const int FLIGHT_LAYERS = 4;

vec3 sky(vec2 q) {
  // GL textures count rows from the bottom; the page counts from the top
  vec3 col = texture(uGas, vec2(q.x / uView.x, 1.0 - q.y / uView.y)).rgb;
  vec2 c = uView * 0.5;
  vec2 d = rot(q - c, -uRoll);
  vec2 rdir = d / max(length(d), 1.0);
  if (uStars > 0.5) {
    // the farthest stars only roll: a fixed backdrop to fly against
    col += stars(d, 7.0, 0.30, 1.0, 0.42, 0.0, 1.0, rdir);
    for (int i = 0; i < FLIGHT_LAYERS; i++) {
      float u = uTravel + float(i) / float(FLIGHT_LAYERS);
      float z = fract(u);                    // 0 far .. 1 near
      float zoom = exp2(z * 4.0);            // 1x .. 16x
      float fade = smoothstep(0.0, 0.22, z) * (1.0 - smoothstep(0.8, 1.0, z));
      float seed = 7.0 + float(i) * 5.0 + floor(u) * 13.0;
      col += stars(d / zoom, 16.0, 0.45, seed, (0.5 + 1.1 * z) * fade, z > 0.5 ? 1.0 : 0.0, zoom, rdir);
    }
    if (uMilky > 0.5) {
      // the band is where the distant stars crowd together
      vec2 bq = c + d + vec2(0.0, uScroll * 0.05);
      vec2 b = band(bq, uView);
      float crowd = b.x * (1.0 - 0.9 * b.y);
      if (crowd > 0.02) col += stars(bq, 4.0, 0.55 * crowd, 21.0, 0.32 * crowd, 0.0, 1.0, rdir);
    }
  }
  return col;
}

// Hot gas colour by temperature: deep red, orange, gold, white, blue-white.
vec3 gasTint(float t) {
  vec3 c = mix(vec3(0.55, 0.10, 0.03), vec3(1.0, 0.42, 0.10), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(1.0, 0.76, 0.40), smoothstep(0.3, 0.58, t));
  c = mix(c, vec3(1.0, 0.95, 0.88), smoothstep(0.58, 0.82, t));
  return mix(c, vec3(0.82, 0.88, 1.0), smoothstep(0.85, 1.0, t));
}


void main() {
  // CSS px with y down, like the page
  vec2 p = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 c = uBH.xy;
  float R = uBH.z;
  vec2 d = p - c;
  float th = length(d);

  // Gravitational lens. Point-lens equation: a source at angle beta is
  // seen at theta with beta = theta - thetaE^2 / theta. Inside the Einstein
  // radius beta flips sign, which is the mirrored secondary image. The
  // effect is windowed off far from the hole so the sky stays put.
  vec2 q = p;
  if (uHole > 0.5 && uLens > 0.5 && th > R * 0.98) {
    float thE = R * 1.32;
    float beta = th - thE * thE / th;
    float w = 1.0 - smoothstep(R * 7.0, R * 13.0, th);
    q = c + (d / th) * mix(th, beta, w);
  }
  vec3 col = sky(q);
  float alpha = 0.0;

  if (uHole > 0.5) {
    float unit = R / B_CRIT;              // CSS px per unit of M
    vec2 l = rot(d, -ROLL);
    vec2 s = vec2(l.x, -l.y) / unit;      // hole frame, y up
    float b = length(s);
    float pxw = 1.0 / (unit * uDpr);      // one device pixel, in units of M
    float t = uTime;

    // Warm light spilled into the surrounding space.
    float halo = exp(-max(0.0, b - B_SHADOW) / 3.2) * 0.10 + exp(-max(0.0, b - B_SHADOW) / 0.6) * 0.18;
    col += vec3(1.0, 0.58, 0.30) * halo * (0.9 + 0.1 * sin(t * 0.8));

    // The shadow: an exact circle, anti-aliased to a sub-pixel edge.
    float cov = clamp(0.5 + (B_SHADOW - b) / pxw, 0.0, 1.0);
    col *= 1.0 - cov;
    alpha = cov;

    // Disk gas, from the traced maps. The gas flows at the Keplerian rate,
    // which shears any pattern without limit over time; two copies half a
    // cycle apart are blended so each is reset while invisible, and the
    // turbulence never smears into noise.
    float E = 0.0;
    float T = 0.0;
    vec2 uv = vec2((s.x + HW) / (2.0 * HW), (HH - s.y) / (2.0 * HH));
    if (uMapReady > 0.5 && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      vec4 m = texture(uMap, uv);
      float base = m.x;
      if (base > 0.0005) {
        float rr = max(m.y, R_IN);
        float phi = atan(m.w, m.z);
        float omega = 2.4 / pow(rr, 1.5);
        float ph = fract(t / FLOW);
        float tA = ph * FLOW, tB = fract(ph + 0.5) * FLOW;
        float wA = 1.0 - abs(2.0 * ph - 1.0);
        vec2 pa = vec2(cos(phi - omega * tA), sin(phi - omega * tA)) * rr;
        vec2 pb = vec2(cos(phi - omega * tB), sin(phi - omega * tB)) * rr;
        float na = fbm(pa * 1.25 + 3.0), nb = fbm(pb * 1.25 + 3.0);
        float n = mix(nb, na, wA);
        // streaks along the orbit, broken up by the turbulence
        float streak = 0.72 + 0.28 * sin(rr * 10.0 + n * 6.0);
        float turb = (0.25 + 1.45 * n) * streak;
        // two hot spots riding the flow
        float sa = max(0.0, cos(phi - 1.9 * omega * tA)), sb = max(0.0, cos(phi - 1.9 * omega * tB));
        float spot = 0.5 * pow(mix(sb, sa, wA), 14.0);
        E = base * turb * (1.0 + spot);
        // Temperature: hotter inward, and Doppler-shifted, so the side
        // coming toward us is bluer as well as brighter.
        float dz = -cos(TILT) * cos(phi);
        float beta = 0.5 * sqrt(R_IN / rr);
        float dopp = 1.0 / (1.0 - beta * dz);
        T = clamp(pow(R_IN / rr, 0.8) * 0.78 * dopp + 0.12 * n, 0.0, 1.0);
      }
    }

    // Photon ring: light wrapped round the hole piles up at the critical
    // curve. Analytic, thin, brighter on the approaching side, shimmering.
    float dR = b - B_SHADOW;
    float ring = 0.0;
    if (dR > -pxw && dR < 1.2) {
      float az = atan(s.y, s.x);
      ring = 1.7 * exp(-max(dR, 0.0) / 0.055) * (1.0 - 0.45 * cos(az));
      ring *= 0.82 + 0.18 * sin(3.0 * az - 2.77 * t);
      ring *= smoothstep(-pxw, pxw, dR); // starts at the shadow edge
    }

    float v = 1.0 - exp(-(E + ring));
    vec3 gas = gasTint(max(T, ring > 0.01 ? 0.75 : 0.0)) * (0.85 + 0.6 * v);
    col = col * (1.0 - v) + gas * v;
    alpha = alpha * (1.0 - v) + v;

    // Bloom: a soft glow off the brightest gas, cheap and analytic.
    float bloom = E * 0.12 + ring * 0.05;
    col += gasTint(0.62) * bloom;
  }

  frag = vec4(col, alpha);
}
`;
