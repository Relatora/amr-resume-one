"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";

export default function LoginGate() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(password)) {
      setError(true);
      setShakeKey((k) => k + 1);
      setPassword("");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-base flex items-center justify-center px-6">
      {/* floating gradient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl animate-blob" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl animate-blob-slow" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl animate-blob" />
      <div className="absolute inset-0 dot-grid" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="gradient-border rounded-2xl p-8 shadow-2xl shadow-black/40">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-300">
            Private preview
          </p>
          <h1 className="font-display mt-3 text-3xl font-bold">
            Amr<span className="gradient-text">.</span>
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Enter the password to view this resume.
          </p>

          <motion.form
            key={shakeKey}
            animate={
              shakeKey > 0 ? { x: [0, -10, 10, -6, 6, 0] } : undefined
            }
            transition={{ duration: 0.4 }}
            onSubmit={submit}
            className="mt-6 space-y-3"
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
              className="w-full rounded-lg border border-line bg-base-soft px-4 py-3 text-sm outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20"
            />
            {error && (
              <p className="text-xs text-rose-400">
                That&apos;s not it — try again.
              </p>
            )}
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-teal-400 via-violet-400 to-amber-400 px-4 py-3 text-sm font-semibold text-base transition hover:opacity-90 active:scale-[0.98]"
            >
              Unlock
            </button>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
}
