"use client";

// Shared form primitives for the edit panel.

export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-dim">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-base px-3 py-2 text-sm outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-dim">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-lg border border-line bg-base px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
      />
    </label>
  );
}

// Editable list of strings with add / remove / reorder — used for
// experience bullets, skill items, and education details.
export function StringListEditor({
  label,
  items,
  onChange,
  multiline = false,
  addLabel = "Add item",
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  multiline?: boolean;
  addLabel?: string;
}) {
  const setItem = (i: number, v: string) =>
    onChange(items.map((item, idx) => (idx === i ? v : item)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const btn =
    "cursor-pointer rounded-md border border-line px-1.5 py-1 text-xs text-ink-dim transition hover:bg-white/5 disabled:opacity-30 disabled:cursor-default";

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-dim">
        {label}
      </span>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {multiline ? (
              <textarea
                value={item}
                onChange={(e) => setItem(i, e.target.value)}
                rows={2}
                className="min-w-0 flex-1 resize-y rounded-lg border border-line bg-base px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
              />
            ) : (
              <input
                value={item}
                onChange={(e) => setItem(i, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-base px-3 py-2 text-sm outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
              />
            )}
            <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className={btn}>
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Move down"
                className={btn}
              >
                ↓
              </button>
              <button
                onClick={() => remove(i)}
                aria-label="Remove"
                className={`${btn} hover:border-rose-400/50 hover:text-rose-300`}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ""])}
          className="cursor-pointer rounded-lg border border-dashed border-teal-400/40 px-3 py-1.5 text-xs text-teal-300 transition hover:bg-teal-400/10"
        >
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

export function DeleteButton({
  onDelete,
  confirming,
  setConfirming,
}: {
  onDelete: () => void;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
}) {
  return confirming ? (
    <span className="flex items-center gap-2">
      <span className="text-xs text-rose-300">Delete this entry?</span>
      <button
        onClick={onDelete}
        className="cursor-pointer rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/30"
      >
        Yes, delete
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs text-ink-dim transition hover:bg-white/5"
      >
        Cancel
      </button>
    </span>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      className="cursor-pointer rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/10"
    >
      Delete
    </button>
  );
}
