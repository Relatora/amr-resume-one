"use client";

import { useCallback, useSyncExternalStore } from "react";

const THEME_KEY = "resume-theme";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());
const getSnapshot = () => document.documentElement.classList.contains("light");
const getServerSnapshot = () => false;

export function useTheme() {
  const light = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "light" : "dark");
    } catch {
      // storage unavailable - theme just won't persist
    }
    emit();
  }, []);

  return { light, toggle };
}
