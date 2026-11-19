"use client";

import { useCallback, useState } from "react";
import Galaxy from "@/components/Galaxy";
import SpaceGL from "./SpaceGL";
import ShootingStars from "./ShootingStars";
import { SPACE_FEATURES } from "./flags";
import { useHydrated } from "@/lib/useHydrated";

// The dark theme's backdrop. The GPU sky (SpaceGL) by default; the 2D
// canvas galaxy (Galaxy) when WebGL2 is unavailable, a shader fails, or
// the GPU context is lost.
export default function DarkSky() {
  const hydrated = useHydrated();
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);

  // Before hydration render nothing device-specific (the server cannot
  // know whether WebGL works here).
  if (!hydrated) return null;
  if (failed) return <Galaxy />;
  return (
    <>
      <SpaceGL onFail={onFail} />
      {SPACE_FEATURES.shooting && <ShootingStars />}
    </>
  );
}
