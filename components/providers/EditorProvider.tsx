"use client";

import { createContext, useContext, useState } from "react";

export type EditTarget =
  | { kind: "personal" }
  | { kind: "experience"; id: string | null } // null = add new
  | { kind: "skills"; id: string | null }
  | { kind: "education"; id: string | null };

// off = viewing · real = owner editing (persists) · demo = visitor try-out (never persists)
export type EditMode = "off" | "real" | "demo";
export type ModalKind = "password" | "demo-info" | null;

interface EditorContextValue {
  mode: EditMode;
  setMode: (mode: EditMode) => void;
  editMode: boolean; // any editing UI active
  modal: ModalKind;
  setModal: (modal: ModalKind) => void;
  target: EditTarget | null;
  openEditor: (target: EditTarget) => void;
  closeEditor: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<EditMode>("off");
  const [modal, setModal] = useState<ModalKind>(null);
  const [target, setTarget] = useState<EditTarget | null>(null);

  const setMode = (next: EditMode) => {
    setModeState(next);
    if (next === "off") setTarget(null);
  };

  return (
    <EditorContext.Provider
      value={{
        mode,
        setMode,
        editMode: mode !== "off",
        modal,
        setModal,
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
