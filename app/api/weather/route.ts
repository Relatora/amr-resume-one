import { headers } from "next/headers";

// Current conditions for the visitor's rough location, used to drive the
// light theme's rain and cloud. Open-Meteo needs no API key and no account,
// which keeps this free and keeps a secret out of the deployment.
//
// Caching lives in module scope rather than `use cache`: that directive needs
// `cacheComponents: true`, which switches the whole app to dynamic-by-default
// rendering and PPR - far too much blast radius for one small lookup. A warm
// serverless instance reuses this map; a cold one just refetches.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: Weather }>();

export interface Weather {
  ok: boolean;
  temp: number | null; // degrees C
  place: string; // where the reading is for
  rain: number; // 0..1 precipitation intensity
  snow: boolean;
  cloud: number; // 0..1 sky cover
  wind: number; // -1..1, signed lean for the falling streaks
  code: number; // WMO weather code
  label: string;
}

const FALLBACK: Weather = {
  ok: false,
  temp: null,
  place: "",
  rain: 0.35,
  snow: false,
  cloud: 0.7,
  wind: 0.2,
  code: 3,
  label: "Overcast",
};

// WMO code groups, enough to name what is happening without a full table
function describe(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

// mm/h to a 0..1 intensity, curved so light rain is still clearly visible
function intensity(mm: number): number {
  if (mm <= 0) return 0;
  return Math.min(1, Math.pow(mm / 6, 0.55));
}

// An IANA timezone carries a city - "America/Toronto" - which Open-Meteo's
// free geocoder turns into coordinates. That gives a browser-derived location
// with no permission prompt, which is what "general location" should cost.
const geoCache = new Map<string, { lat: number; lon: number; name: string } | null>();

async function fromTimezone(tz: string) {
  if (geoCache.has(tz)) return geoCache.get(tz)!;
  const city = tz.split("/").pop()?.replace(/_/g, " ");
  if (!city) {
    geoCache.set(tz, null);
    return null;
  }
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    const j = await r.json();
    const hit = j?.results?.[0];
    const out = hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name as string } : null;
    geoCache.set(tz, out);
    return out;
  } catch {
    geoCache.set(tz, null);
    return null;
  }
}

export async function GET(request: Request) {
  const h = await headers();
  const tz = new URL(request.url).searchParams.get("tz") ?? "";
  // Vercel attaches these to every function request on all plans. Rounded to
  // one decimal (~11km) before it leaves us: plenty for weather, and it means
  // no precise visitor location is handed to a third party.
  // Number(null) is 0, not NaN, so a missing header would otherwise read as
  // a perfectly valid 0,0 - the Gulf of Guinea - and quietly report the
  // weather there. Check the header exists before converting.
  const latH = h.get("x-vercel-ip-latitude");
  const lonH = h.get("x-vercel-ip-longitude");
  const rawLat = latH ? Number(latH) : NaN;
  const rawLon = lonH ? Number(lonH) : NaN;
  const hasGeo =
    Number.isFinite(rawLat) &&
    Number.isFinite(rawLon) &&
    !(rawLat === 0 && rawLon === 0);

  // The browser's own timezone wins, then the edge's view of the IP, then
  // Sarnia so local development has something to draw.
  const viaTz = tz ? await fromTimezone(tz) : null;
  const place = viaTz?.name ?? "";
  const lat = (viaTz ? viaTz.lat : hasGeo ? rawLat : 42.97).toFixed(1);
  const lon = (viaTz ? viaTz.lon : hasGeo ? rawLon : -82.4).toFixed(1);

  const key = `${lat},${lon},${place}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Response.json(hit.data, {
      headers: { "Cache-Control": "private, max-age=600" },
    });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation,snowfall,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const j = await res.json();
    const cur = j.current ?? {};

    const code = Number(cur.weather_code ?? 3);
    const snow = Number(cur.snowfall ?? 0) > 0 || (code >= 70 && code <= 79) || code === 85 || code === 86;
    // snowfall reports in cm; scale it up so a light dusting still shows
    const amount = snow
      ? Number(cur.snowfall ?? 0) * 10
      : Number(cur.precipitation ?? 0);

    // wind direction is where it comes FROM; east-west part gives the lean
    const dir = ((Number(cur.wind_direction_10m ?? 0) % 360) * Math.PI) / 180;
    const speed = Number(cur.wind_speed_10m ?? 0);
    const wind = Math.max(-1, Math.min(1, (-Math.sin(dir) * speed) / 40));

    const data: Weather = {
      ok: true,
      rain: intensity(amount),
      snow,
      cloud: Math.max(0, Math.min(1, Number(cur.cloud_cover ?? 70) / 100)),
      wind,
      code,
      label: describe(code),
      temp: Number.isFinite(Number(cur.temperature_2m)) ? Math.round(Number(cur.temperature_2m)) : null,
      place,
    };
    cache.set(key, { at: Date.now(), data });
    return Response.json(data, {
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch {
    // never let the backdrop break because a third party is slow or down
    return Response.json(FALLBACK, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }
}
