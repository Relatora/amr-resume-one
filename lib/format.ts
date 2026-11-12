// Formats an entry's date range for display. Undated entries (the condensed
// earlier-career entry, the Bachelor's degree) render nothing instead of a
// stray " - ", and a single-year role ("2020 - 2020") collapses to "2020".
export function formatRange(start: string, end: string): string {
  const s = start.trim();
  const e = end.trim();
  if (!s && !e) return "";
  if (!s || !e || s === e) return s || e;
  return `${s} - ${e}`;
}
