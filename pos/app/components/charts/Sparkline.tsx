"use client";

import { useId } from "react";
import { smoothPath } from "./smoothPath";

/** Edge-to-edge mini trend for KPI tiles. Uses a fixed viewBox and non-scaling stroke. */
export function Sparkline({ values, color = "var(--c1)", height = 46 }: { values: number[]; color?: string; height?: number }) {
  const gradientId = useId().replace(/:/g, "");
  const w = 200;
  const max = Math.max(...values, 0);
  const count = values.length;
  const points = values.map((v, i) => ({
    x: count <= 1 ? w / 2 : (i / (count - 1)) * w,
    y: max > 0 ? height - 4 - (v / max) * (height - 10) : height - 4,
  }));
  const line = smoothPath(points);
  const area = count > 1 ? `${line} L${w},${height} L0,${height} Z` : "";

  return (
    <svg className="lx-chart" width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g key={values.join(",")}>
        {area && <path className="area" d={area} fill={`url(#spark-${gradientId})`} />}
        <path className="line" d={line} stroke={color} pathLength={1} style={{ strokeWidth: 2 }} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
