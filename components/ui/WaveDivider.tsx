// Wavy separator between page sections. Translucent soft-canvas fill so the
// band reads as tinted glass and the galaxy stays visible behind it - must
// match the Skills band's bg-canvas-soft/60.
export default function WaveDivider({ flip = false }: { flip?: boolean }) {
  return (
    <div aria-hidden className={flip ? "rotate-180" : undefined}>
      <svg
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        className="block h-10 w-full sm:h-16"
      >
        <path
          d="M0,40 C180,72 360,8 560,26 C760,44 900,70 1100,52 C1240,40 1360,16 1440,30 L1440,72 L0,72 Z"
          className="fill-canvas-soft/60"
        />
        <path
          d="M0,52 C220,20 420,66 640,48 C860,30 1040,10 1240,34 C1320,44 1400,50 1440,46 L1440,72 L0,72 Z"
          className="fill-canvas-soft/60"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
