"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

// Client-side friction gate only - not real security. To be replaced with
// proper auth in a later phase.
const PASSWORD = "canu";
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
