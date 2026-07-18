"use client";

import { createContext, useContext, useState } from "react";

export type EditTarget =
  | { kind: "personal" }
  | { kind: "experience"; id: string | null } // null = add new
  | { kind: "skills"; id: string | null }
  | { kind: "education"; id: string | null };

interface EditorContextValue {
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  target: EditTarget | null;
  openEditor: (target: EditTarget) => void;
  closeEditor: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);

  return (
    <EditorContext.Provider
      value={{
        editMode,
        setEditMode: (on) => {
          setEditMode(on);
          if (!on) setTarget(null);
        },
        target,
        openEditor: setTarget,
        closeEditor: () => setTarget(null),
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
