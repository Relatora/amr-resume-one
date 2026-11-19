// Which parts of the dark sky are drawn. All on; each maps to a uniform in
// the shaders (or, for shooting stars, a component), so one of them can be
// switched off here without touching the rendering code. They were tuned
// on the live page with a temporary toggle bar.
export const SPACE_FEATURES = {
  hole: true, // the black hole, its disk and photon ring
  lensing: true, // stars and gas bend around the hole
  stars: true, // coloured stars in three parallax layers
  milkyWay: true, // the band of distant stars and its dust lane
  nebula: true, // filamented gas clouds
  shooting: true, // the occasional meteor
} as const;
