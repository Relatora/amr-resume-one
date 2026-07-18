"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ResumeContent } from "@/lib/types";
import { useEditor } from "@/components/providers/EditorProvider";

const LOCAL_KEY = "resume-content-local";

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "disk" }
  | { status: "local" }
  | { status: "error"; message: string };

interface ContentContextValue {
  content: ResumeContent;
  saveState: SaveState;
  hasLocalOverride: boolean;
  update: (updater: (current: ResumeContent) => ResumeContent) => void;
  downloadJson: () => void;
  discardLocalOverride: () => void;
  // demo mode: try-out edits that never persist
  demoDirty: boolean;
  startDemo: () => void;
  resetDemo: () => void;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({
  initial,
  children,
}: {
  initial: ResumeContent;
  children: React.ReactNode;
}) {
  const { mode } = useEditor();
  const [content, setContent] = useState<ResumeContent>(initial);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [hasLocalOverride, setHasLocalOverride] = useState(false);
  const [demoDirty, setDemoDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoBaseline = useRef<ResumeContent | null>(null);

  // Overlay any edits previously saved in this browser (production case,
  // where writes to content.json aren't possible).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      if (stored) {
        // Must run post-hydration: reading localStorage during render would
        // make client HTML diverge from the server-rendered content.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setContent(JSON.parse(stored) as ResumeContent);
        setHasLocalOverride(true);
      }
    } catch {
      localStorage.removeItem(LOCAL_KEY);
    }
  }, []);

  const persist = useCallback((next: ResumeContent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState({ status: "saving" });
    // Debounce so rapid edits produce one write.
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (res.ok) {
          // Disk is now the source of truth; drop any browser-local copy.
          localStorage.removeItem(LOCAL_KEY);
          setHasLocalOverride(false);
          setSaveState({ status: "disk" });
          return;
        }
      } catch {
        // fall through to localStorage
      }
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setHasLocalOverride(true);
        setSaveState({ status: "local" });
      } catch (err) {
        setSaveState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not save",
        });
      }
    }, 600);
  }, []);

  const update = useCallback(
    (updater: (current: ResumeContent) => ResumeContent) => {
      setContent((current) => {
        const next = updater(current);
        if (mode === "demo") {
          setDemoDirty(true);
        } else {
          persist(next);
        }
        return next;
      });
    },
    [persist, mode]
  );

  const startDemo = useCallback(() => {
    setContent((current) => {
      demoBaseline.current = current;
      return current;
    });
    setDemoDirty(false);
  }, []);

  const resetDemo = useCallback(() => {
    if (demoBaseline.current) setContent(demoBaseline.current);
    setDemoDirty(false);
  }, []);

  const downloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(content, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  const discardLocalOverride = useCallback(() => {
    localStorage.removeItem(LOCAL_KEY);
    setHasLocalOverride(false);
    setSaveState({ status: "idle" });
    setContent(initial);
  }, [initial]);

  return (
    <ContentContext.Provider
      value={{
        content,
        saveState,
        hasLocalOverride,
        update,
        downloadJson,
        discardLocalOverride,
        demoDirty,
        startDemo,
        resetDemo,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used within ContentProvider");
  return ctx;
}
