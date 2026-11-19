"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// False during server rendering and the hydration pass, true afterwards.
// Anything decided by the visitor's device (screen width, reduced-motion
// preference) must wait for this: the server cannot know it, and deciding
// it on the first client render makes the HTML disagree with the server's.
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
