"use client";

// Small pencil / reorder buttons shown on entries while edit mode is on.
export function EditButton({
  onClick,
  label = "Edit",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="cursor-pointer rounded-md border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-xs text-accent-violet transition hover:bg-violet-400/20"
    >
      ✎ {label}
    </button>
  );
}

export function MoveButtons({
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const base =
    "cursor-pointer rounded-md border border-line px-2 py-1 text-xs text-ink-dim transition hover-veil disabled:opacity-30 disabled:cursor-default";
  return (
    <span className="inline-flex gap-1">
      <button onClick={onUp} disabled={!canUp} aria-label="Move up" className={base}>
        ↑
      </button>
      <button
        onClick={onDown}
        disabled={!canDown}
        aria-label="Move down"
        className={base}
      >
        ↓
      </button>
    </span>
  );
}

export function AddButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-dashed border-teal-400/40 px-4 py-2 text-sm text-accent-teal transition hover:bg-teal-400/10"
    >
      + {label}
    </button>
  );
}
