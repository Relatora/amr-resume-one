"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

// Client-side friction gate only - not real security. NEXT_PUBLIC_ values are
// inlined into the browser bundle at build time, so this password is readable
// by anyone who opens devtools; it only keeps casual visitors out of edit mode.
// To be replaced with proper auth in a later phase.
const PASSWORD = process.env.NEXT_PUBLIC_EDIT_PASSWORD;
const SESSION_KEY = "resume-authed";

// The stored value is derived from the password rather than a constant flag.
// A constant meant a browser unlocked under an old password stayed unlocked
// forever; deriving it means rotating NEXT_PUBLIC_EDIT_PASSWORD invalidates
// every existing session. FNV-1a is enough - this obscures nothing (the
// password ships in the bundle), it just ties the token to one password.
const tokenFor = (password: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

const currentToken = () => (PASSWORD ? tokenFor(PASSWORD) : null);

// sessionStorage as an external store so hydration stays consistent.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());

const getSnapshot = () => {
  const want = currentToken();
  if (!want) return false;
  try {
    // "remember me" persists in localStorage; otherwise it dies with the tab
    return (
      localStorage.getItem(SESSION_KEY) === want ||
      sessionStorage.getItem(SESSION_KEY) === want
    );
  } catch {
    return false; // storage unavailable (private mode, blocked cookies)
  }
};
const getServerSnapshot = () => false;

interface AuthContextValue {
  authed: boolean;
  login: (password: string, remember?: boolean) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((password: string, remember = false) => {
    // No password configured (missing .env or Vercel env var): stay locked
    // rather than letting an empty string through.
    const want = currentToken();
    if (!want || password !== PASSWORD) return false;
    try {
      // write to one store and clear the other, so unchecking "remember me"
      // on a later sign-in actually downgrades the session
      const [keep, drop] = remember
        ? [localStorage, sessionStorage]
        : [sessionStorage, localStorage];
      keep.setItem(SESSION_KEY, want);
      drop.removeItem(SESSION_KEY);
    } catch {
      return false; // can't persist, so don't claim to be signed in
    }
    emit();
    return true;
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // storage unavailable - nothing to clear
    }
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
