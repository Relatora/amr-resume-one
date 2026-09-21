"use client";

import { useEffect, useState } from "react";
import { loadWeather, subscribeWeather, type WeatherNow } from "@/lib/weather";

// Icons are inline so there is no sprite sheet to ship and each one can pick
// up the accent colours already in the palette. WMO code groups pick the mark.
function Icon({ code, snow }: { code: number; snow: boolean }) {
  const cls = "h-4 w-4 shrink-0";
  const sun = <circle cx="12" cy="12" r="4.4" className="fill-amber-400" />;
  const rays = (
    <g className="stroke-amber-400" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </g>
  );
  const cloud = (
    <path
      d="M7.4 18h9.1a3.6 3.6 0 0 0 .3-7.2 5.3 5.3 0 0 0-10.2-1A3.7 3.7 0 0 0 7.4 18Z"
      className="fill-slate-400/80"
    />
  );

  if (snow || (code >= 70 && code <= 79) || code === 85 || code === 86)
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        {cloud}
        <g className="fill-sky-300">
          <circle cx="9" cy="20.6" r="1.1" />
          <circle cx="12.6" cy="21.4" r="1.1" />
          <circle cx="16" cy="20.6" r="1.1" />
        </g>
      </svg>
    );

  if (code >= 95)
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        {cloud}
        <path d="M12.8 18l-2.6 4.4h2.4L11.4 24l4.2-4.8h-2.4l1-1.2Z" className="fill-amber-400" />
      </svg>
    );

  if ((code >= 51 && code <= 69) || (code >= 80 && code <= 82))
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        {cloud}
        <g className="stroke-sky-400" strokeWidth="1.8" strokeLinecap="round">
          <path d="M9 19.6l-1 2.6M12.6 19.6l-1 2.6M16.2 19.6l-1 2.6" />
        </g>
      </svg>
    );

  if (code === 3)
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        {cloud}
      </svg>
    );

  if (code === 1 || code === 2)
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <circle cx="9" cy="9.5" r="3.6" className="fill-amber-400" />
        {cloud}
      </svg>
    );

  if (code >= 45 && code <= 49)
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <g className="stroke-slate-400" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 9h16M4 13h16M6 17h12" />
        </g>
      </svg>
    );

  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden>
      {rays}
      {sun}
    </svg>
  );
}

export default function WeatherChip() {
  const [w, setW] = useState<WeatherNow | null>(null);

  useEffect(() => {
    const off = subscribeWeather(setW);
    loadWeather();
    return () => {
      off();
    };
  }, []);

  // Nothing until the reading lands, so the header never shifts around a
  // placeholder that might never be filled.
  if (!w || !w.ok) return null;

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-line/70 px-2.5 py-1 text-xs text-ink-dim sm:inline-flex"
      title={`${w.label}${w.place ? ` in ${w.place}` : ""}`}
    >
      <Icon code={w.code} snow={w.snow} />
      {w.temp !== null && <span className="tabular-nums">{w.temp}°</span>}
      <span className="hidden md:inline">{w.label}</span>
    </span>
  );
}
