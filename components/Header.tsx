"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";

const NAV = [
  { href: "#experience", label: "Experience" },
  { href: "#skills", label: "Skills" },
  { href: "#education", label: "Education" },
  { href: "#contact", label: "Contact" },
];

function SaveBadge() {
  const { saveState, hasLocalOverride, downloadJson, discardLocalOverride } =
    useContent();

  if (saveState.status === "idle" && !hasLocalOverride) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {saveState.status === "saving" && (
        <span className="text-ink-dim">Saving…</span>
      )}
      {saveState.status === "disk" && (
        <span className="text-teal-300">Saved to content.json</span>
      )}
      {saveState.status === "local" && (
        <span className="text-amber-300">Saved in this browser</span>
      )}
      {saveState.status === "error" && (
        <span className="text-rose-400">Save failed</span>
      )}
      {hasLocalOverride && (
        <>
          <button
            onClick={downloadJson}
            className="cursor-pointer rounded-md border border-amber-400/40 px-2 py-1 text-amber-300 transition hover:bg-amber-400/10"
            title="Download content.json with your local edits to commit to the repo"
          >
            Download JSON
          </button>
          <button
            onClick={discardLocalOverride}
            className="cursor-pointer rounded-md border border-line px-2 py-1 text-ink-dim transition hover:bg-white/5"
            title="Discard edits stored in this browser"
          >
            Discard
          </button>
        </>
      )}
    </div>
  );
}

export default function Header() {
  const { logout } = useAuth();
  const { editMode, setEditMode } = useEditor();

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-base/70 backdrop-blur-lg"
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="font-display text-lg font-bold">
          Amr<span className="gradient-text">.</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-ink-dim transition hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SaveBadge />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-dim">
            <span className={editMode ? "text-ink" : undefined}>Edit</span>
            <button
              role="switch"
              aria-checked={editMode}
              onClick={() => setEditMode(!editMode)}
              className={`relative h-6 w-11 cursor-pointer rounded-full transition ${
                editMode
                  ? "bg-gradient-to-r from-teal-400 to-violet-400"
                  : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  editMode ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </label>
          <button
            onClick={logout}
            className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs text-ink-dim transition hover:bg-white/5 hover:text-ink"
          >
            Lock
          </button>
        </div>
      </div>
    </motion.header>
  );
}
