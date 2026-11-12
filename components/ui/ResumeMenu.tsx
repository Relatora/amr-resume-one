"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";

// "Download resume" button that lets the visitor pick the version for the
// role they are hiring for. It follows the WAI-ARIA menu button pattern:
// the button toggles the menu, arrow keys move between options, Escape or a
// click outside closes it, and focus returns to the button.
export default function ResumeMenu({ className = "" }: { className?: string }) {
  const { content } = useContent();
  // Edits saved in a browser before role-based resumes existed have no
  // `resumes` field; fall back to an empty list instead of crashing.
  const resumes = content.personal.resumes ?? [];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();

  // Close on any click outside the component while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it opens, so keyboard users land on the
  // first option.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  if (resumes.length === 0) return null;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`press inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line text-sm font-semibold text-ink transition hover:border-teal-400/50 hover-veil ${className}`}
      >
        Download resume (PDF)
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 fill-current transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Choose a resume by role"
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 z-30 mt-2 min-w-full w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-card p-1 text-left shadow-xl shadow-black/20"
          >
            <p className="px-3 pt-2 pb-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-dim">
              Choose a role
            </p>
            {resumes.map((r, i) => (
              <a
                key={r.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                href={`/resume/${r.id}`}
                download
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm text-ink transition hover-veil focus:outline-none focus-visible:bg-[color-mix(in_oklab,var(--color-ink)_9%,transparent)]"
              >
                {r.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
