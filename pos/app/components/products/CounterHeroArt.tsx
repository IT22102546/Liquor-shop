/**
 * Decorative row of backlit bottles for the Bar Counter banner. Pure SVG, so it needs no image
 * files and follows the theme through CSS variables (--hero-glow, --hero-shelf).
 */

type Bottle = { x: number; w: number; h: number; neck: number; neckH: number; glass: string; label: string; cap: string };

// Left to right: short to tall, mixing amber whisky, green beer and dark arrack bottles.
const BOTTLES: Bottle[] = [
  { x: 40, w: 30, h: 66, neck: 10, neckH: 30, glass: "green", label: "#e9dcc0", cap: "#c9a14d" },
  { x: 92, w: 44, h: 78, neck: 13, neckH: 34, glass: "amber", label: "#f1e3c3", cap: "#2b2116" },
  { x: 152, w: 34, h: 74, neck: 11, neckH: 40, glass: "dark", label: "#d9b35a", cap: "#d9b35a" },
  { x: 204, w: 48, h: 86, neck: 14, neckH: 30, glass: "amber", label: "#1f1a12", cap: "#c9a14d" },
  { x: 268, w: 32, h: 70, neck: 10, neckH: 36, glass: "green", label: "#f0e6cf", cap: "#b8862f" },
  { x: 316, w: 40, h: 82, neck: 12, neckH: 38, glass: "dark", label: "#e9dcc0", cap: "#7a2c22" },
];

const GLASS: Record<string, [string, string]> = {
  amber: ["#f3b34a", "#7a3e0c"],
  green: ["#5fae62", "#133d1e"],
  dark: ["#6b3b24", "#1b0f0a"],
};

/** Bottle outline: body with rounded shoulders narrowing into the neck. */
function bottlePath({ x, w, h, neck, neckH }: Bottle, floor: number) {
  const left = x - w / 2;
  const right = x + w / 2;
  const top = floor - h;
  const shoulder = Math.min(18, w * 0.45);
  const neckTop = top - neckH;
  return [
    `M${left + 4},${floor}`,
    `Q${left},${floor} ${left},${floor - 4}`,
    `L${left},${top + shoulder}`,
    `C${left},${top + 2} ${x - neck / 2},${top + shoulder * 0.4} ${x - neck / 2},${top - 2}`,
    `L${x - neck / 2},${neckTop}`,
    `L${x + neck / 2},${neckTop}`,
    `L${x + neck / 2},${top - 2}`,
    `C${x + neck / 2},${top + shoulder * 0.4} ${right},${top + 2} ${right},${top + shoulder}`,
    `L${right},${floor - 4}`,
    `Q${right},${floor} ${right - 4},${floor}`,
    "Z",
  ].join(" ");
}

export function CounterHeroArt() {
  const floor = 132;
  return (
    <svg className="pos-hero-art" viewBox="0 0 380 140" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="heroGlow" cx="55%" cy="70%" r="60%">
          <stop offset="0%" style={{ stopColor: "var(--hero-glow)", stopOpacity: 0.75 }} />
          <stop offset="100%" style={{ stopColor: "var(--hero-glow)", stopOpacity: 0 }} />
        </radialGradient>
        {Object.entries(GLASS).map(([name, [light, dark]]) => (
          <linearGradient key={name} id={`glass-${name}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={dark} />
            <stop offset="45%" stopColor={light} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
        ))}
        <linearGradient id="heroShine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="210" cy="118" rx="200" ry="90" fill="url(#heroGlow)" />
      <rect x="0" y={floor} width="380" height="8" rx="2" style={{ fill: "var(--hero-shelf)" }} />
      {BOTTLES.map((bottle, index) => {
        const top = floor - bottle.h;
        return (
          <g key={index} className="pos-hero-bottle" style={{ ["--d" as string]: `${index * 90}ms` }}>
            <path d={bottlePath(bottle, floor)} fill={`url(#glass-${bottle.glass})`} />
            <rect x={bottle.x - bottle.neck / 2 - 1} y={top - bottle.neckH - 6} width={bottle.neck + 2} height={8} rx={2} fill={bottle.cap} />
            <rect x={bottle.x - bottle.w / 2 + 3} y={top + bottle.h * 0.34} width={bottle.w - 6} height={bottle.h * 0.34} rx={3} fill={bottle.label} opacity="0.92" />
            <rect x={bottle.x - bottle.w / 2 + 7} y={top + bottle.h * 0.44} width={bottle.w - 14} height={2.5} rx={1} fill="#000" opacity="0.28" />
            <rect x={bottle.x - bottle.w / 2 + 10} y={top + bottle.h * 0.52} width={bottle.w - 20} height={2} rx={1} fill="#000" opacity="0.18" />
            <rect x={bottle.x - bottle.w / 2 + 4} y={top + 6} width={4} height={bottle.h - 14} rx={2} fill="url(#heroShine)" />
          </g>
        );
      })}
    </svg>
  );
}
