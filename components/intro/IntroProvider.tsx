"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useContent } from "@/components/providers/ContentProvider";
import ProjectIntro from "@/components/intro/ProjectIntro";

// The intro plays on the first page load of a browser session. sessionStorage
// (not localStorage) is the point: a returning visitor in a new session sees
// it once more, but reloading or navigating back within a visit does not.
const SEEN_KEY = "resume-intro-seen";

interface IntroContextValue {
  open: boolean;
  play: () => void;
  // Bumped every time the intro closes, so the replay button can pulse and
  // show the visitor where the spot went.
  landings: number;
}

const IntroContext = createContext<IntroContextValue | null>(null);

function markSeen(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
    sessionStorage.setItem(SEEN_KEY, "1");
    return true;
  } catch {
    // Storage blocked (private mode, sandboxed preview): play on every load
    // rather than never, since the visitor can always skip it.
    return true;
  }
}

export function IntroProvider({ children }: { children: React.ReactNode }) {
  const { content } = useContent();
  const projects = content.projects ?? [];
  const [open, setOpen] = useState(false);
  const [landings, setLandings] = useState(0);

  // Autoplay once, after hydration. Skipped for deep links (/#contact): that
  // visitor came for a specific section and an intro would be in the way.
  useEffect(() => {
    if (projects.length === 0 || window.location.hash) return;
    // Runs post-hydration on purpose: the server cannot know whether this
    // session has already seen the intro.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (markSeen()) setOpen(true);
    // Only on mount: editing projects later must not restart the spot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    setLandings((n) => n + 1);
  }, []);

  return (
    <IntroContext.Provider value={{ open, play, landings }}>
      {children}
      <ProjectIntro
        open={open && projects.length > 0}
        projects={projects}
        brand={content.personal.name.split(" ")[0]}
        onClose={close}
      />
    </IntroContext.Provider>
  );
}

export function useIntro() {
  const ctx = useContext(IntroContext);
  if (!ctx) throw new Error("useIntro must be used within IntroProvider");
  return ctx;
}
