"use client";

interface AreaChartProps {
  values: number[];
  color: string;
}

export function AreaChart({ values, color }: AreaChartProps) {
  const w = 280;
  const h = 72;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 8)}`)
    .join(" ");
  const fill = `${pts} ${w},${h} 0,${h}`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="area-chart-svg">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill="url(#areaGrad)" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="area-line"
      />
    </svg>
  );
}
