"use client";

import { motion } from "framer-motion";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/components/providers/AuthProvider";

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
        <span className="text-accent-teal">Saved to content.json</span>
      )}
      {saveState.status === "local" && (
        <span className="text-accent-amber">Saved in this browser</span>
      )}
      {saveState.status === "error" && (
        <span className="text-accent-rose">Save failed</span>
      )}
      {hasLocalOverride && (
        <>
          <button
            onClick={downloadJson}
            className="cursor-pointer rounded-md border border-amber-400/40 px-2 py-1 text-accent-amber transition hover:bg-amber-400/10"
            title="Download content.json with your local edits to commit to the repo"
          >
            Download JSON
          </button>
          <button
            onClick={discardLocalOverride}
            className="hover-veil cursor-pointer rounded-md border border-line px-2 py-1 text-ink-dim transition"
            title="Discard edits stored in this browser"
          >
            Discard
          </button>
        </>
      )}
    </div>
  );
}

function ResetButton() {
  const { resetDemo } = useContent();

  return (
    <span className="group relative">
      <button
        onClick={resetDemo}
        className="cursor-pointer rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-accent-amber transition hover:bg-amber-400/20"
      >
        ↺ Reset
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-52 rounded-lg border border-line bg-card px-3 py-2 text-xs leading-relaxed text-ink-dim shadow-xl group-hover:block"
      >
        This will reset the resume to its original form.
      </span>
    </span>
  );
}

function EditControls() {
  const { mode, setMode, setModal } = useEditor();
  const { authed } = useAuth();
  const { demoDirty, resetDemo } = useContent();

  if (mode === "real") {
    return (
      <div className="flex items-center gap-2">
        <SaveBadge />
        <button
          onClick={() => setMode("off")}
          className="cursor-pointer rounded-md bg-gradient-to-r from-teal-400 to-violet-400 px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90"
        >
          Done editing
        </button>
      </div>
    );
  }

  if (mode === "demo") {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-xs text-accent-violet sm:inline">
          Demo — edits won&apos;t be saved
        </span>
        {demoDirty && <ResetButton />}
        <button
          onClick={() => {
            resetDemo();
            setMode("off");
          }}
          className="hover-veil cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs text-ink-dim transition"
        >
          Exit demo
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => (authed ? setMode("real") : setModal("password"))}
        className="cursor-pointer rounded-md border border-teal-400/40 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-accent-teal transition hover:bg-teal-400/20"
      >
        ✎ Edit
      </button>
      <button
        onClick={() => setModal("demo-info")}
        className="cursor-pointer rounded-md border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-accent-violet transition hover:bg-violet-400/20"
      >
        Try demo
      </button>
    </div>
  );
}

export default function Header() {
  const { light, toggle } = useTheme();

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-canvas/70 backdrop-blur-lg"
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

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggle}
            role="switch"
            aria-checked={light}
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
            title={light ? "Switch to dark mode" : "Switch to light mode"}
            className={`relative flex h-8 w-[60px] shrink-0 cursor-pointer items-center rounded-full border px-1 transition-colors ${
              light
                ? "justify-end border-amber-400/60 bg-amber-400/15"
                : "justify-start border-violet-400/50 bg-violet-400/15"
            }`}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-sm shadow-md ${
                light
                  ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950"
                  : "bg-gradient-to-br from-violet-400 to-indigo-600 text-white"
              }`}
            >
              {light ? "☀" : "☾"}
            </motion.span>
          </button>
          <EditControls />
        </div>
      </div>
    </motion.header>
  );
}
