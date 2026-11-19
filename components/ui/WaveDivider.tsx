import { PaperWaves, type WaveLayer } from "@/components/paper/Paper";

// Paper version for the light theme: two sheets that slide against each
// other on scroll. The front sheet matches the Skills band's light fill.
const PAPER_EDGE: WaveLayer[] = [
  { fill: "#d6ebf8", amp: 12, length: 480, base: 34, speed: 0.1 },
  { fill: "rgba(255,255,255,0.7)", amp: 14, length: 720, base: 48, speed: -0.14 },
];

// Wavy separator between page sections. Dark theme: a translucent
// soft-canvas fill so the band reads as tinted glass and the galaxy stays
// visible behind it - must match the Skills band's bg-canvas-soft/60.
export default function WaveDivider({ flip = false }: { flip?: boolean }) {
  return (
    <>
      <div aria-hidden className={`[.light_&]:hidden ${flip ? "rotate-180" : ""}`}>
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
      <div className="hidden [.light_&]:block">
        <PaperWaves layers={PAPER_EDGE} height={72} flip={flip} className="h-10 sm:h-16" />
      </div>
    </>
  );
}
