"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

// Client-side friction gate only - not real security. NEXT_PUBLIC_ values are
// inlined into the browser bundle at build time, so this password is readable
// by anyone who opens devtools; it only keeps casual visitors out of edit mode.
// To be replaced with proper auth in a later phase.
const PASSWORD = process.env.NEXT_PUBLIC_EDIT_PASSWORD;
const SESSION_KEY = "resume-authed";

// sessionStorage as an external store so hydration stays consistent.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());
const getSnapshot = () => sessionStorage.getItem(SESSION_KEY) === "1";
const getServerSnapshot = () => false;

interface AuthContextValue {
  authed: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((password: string) => {
    // No password configured (missing .env or Vercel env var): stay locked
    // rather than letting an empty string through.
    if (!PASSWORD) return false;
    if (password === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      emit();
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    emit();
  }, []);

  return (
    <AuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
