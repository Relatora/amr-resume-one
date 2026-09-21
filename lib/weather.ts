"use client";

// One weather lookup, shared by the header chip and the canvas backdrop.
// Both want the same reading, and neither should trigger its own request.

export interface WeatherNow {
  ok: boolean;
  rain: number; // 0..1 precipitation intensity
  snow: boolean;
  cloud: number; // 0..1 sky cover
  wind: number; // -1..1 signed lean
  code: number; // WMO weather code
  label: string;
  temp: number | null;
  place: string;
}

let current: WeatherNow | null = null;
let inflight: Promise<WeatherNow | null> | null = null;
const listeners = new Set<(w: WeatherNow) => void>();

export function subscribeWeather(cb: (w: WeatherNow) => void) {
  listeners.add(cb);
  if (current) cb(current);
  return () => listeners.delete(cb);
}

export function loadWeather(): Promise<WeatherNow | null> {
  if (current) return Promise.resolve(current);
  if (inflight) return inflight;

  // The browser's timezone is the location hint: it names a city, costs no
  // permission prompt, and is about as precise as weather needs.
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    // some locked-down browsers refuse; the server falls back to the edge IP
  }

  inflight = fetch(`/api/weather${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((w: WeatherNow | null) => {
      if (w && typeof w.rain === "number") {
        current = w;
        listeners.forEach((cb) => cb(w));
        return w;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
