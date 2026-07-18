"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { useContent } from "@/components/providers/ContentProvider";
import { useEditor } from "@/components/providers/EditorProvider";

const BOUNCE = { type: "spring", stiffness: 420, damping: 17 } as const;

function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 48 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7, y: 24 }}
        transition={BOUNCE}
        className="gradient-border relative w-full max-w-sm rounded-2xl p-7 shadow-2xl shadow-black/40"
      >
        {children}
      </motion.div>
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const { setMode } = useEditor();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setMode("real");
      onClose();
    } else {
      setError(true);
      setShakeKey((k) => k + 1);
      setPassword("");
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-300">
        Owner access
      </p>
      <h2 className="font-display mt-2 text-2xl font-bold">Edit resume</h2>
      <p className="mt-2 text-sm text-ink-dim">
        Enter the password to unlock editing.
      </p>
      <motion.form
        key={shakeKey}
        animate={shakeKey > 0 ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
        transition={{ duration: 0.4 }}
        onSubmit={submit}
        className="mt-5 space-y-3"
      >
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          autoFocus
          className="w-full rounded-lg border border-line bg-base px-4 py-3 text-sm outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
        />
        {error && (
          <p className="text-xs text-rose-400">That&apos;s not it — try again.</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-teal-400 via-violet-400 to-amber-400 px-4 py-3 text-sm font-semibold text-base transition hover:opacity-90 active:scale-[0.98]"
          >
            Unlock
          </button>
          <button
            type="button"
            onClick={onClose}
            className="hover-veil cursor-pointer rounded-lg border border-line px-4 py-3 text-sm text-ink-dim transition"
          >
            Cancel
          </button>
        </div>
      </motion.form>
    </ModalShell>
  );
}

function DemoInfoModal({ onClose }: { onClose: () => void }) {
  const { setMode } = useEditor();
  const { startDemo } = useContent();

  const begin = () => {
    startDemo();
    setMode("demo");
    onClose();
  };

  return (
    <ModalShell onClose={onClose}>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-violet-300">
        Try it out
      </p>
      <h2 className="font-display mt-2 text-2xl font-bold">Demo edit mode</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-dim">
        This lets you play with the in-page editor — rearrange entries, change
        text, add or remove items.{" "}
        <span className="font-semibold text-ink">
          Nothing you change will be saved
        </span>{" "}
        — it&apos;s here just to show off the editing capability. A Reset
        button will appear so you can put everything back at any time.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={begin}
          className="flex-1 cursor-pointer rounded-lg bg-gradient-to-r from-teal-400 to-violet-400 px-4 py-3 text-sm font-semibold text-base transition hover:opacity-90 active:scale-[0.98]"
        >
          Let me try
        </button>
        <button
          onClick={onClose}
          className="hover-veil cursor-pointer rounded-lg border border-line px-4 py-3 text-sm text-ink-dim transition"
        >
          Maybe later
        </button>
      </div>
    </ModalShell>
  );
}

export default function Modals() {
  const { modal, setModal } = useEditor();

  return (
    <AnimatePresence>
      {modal === "password" && (
        <PasswordModal key="password" onClose={() => setModal(null)} />
      )}
      {modal === "demo-info" && (
        <DemoInfoModal key="demo-info" onClose={() => setModal(null)} />
      )}
    </AnimatePresence>
  );
}
