"use client";

import { useEffect, useId, useRef, useState } from "react";
import { niceCeil, smoothPath } from "./smoothPath";

type TrendChartProps = {
  labels: string[];
  values: number[];
  /** Optional previous-period series, drawn as a dashed comparison line. */
  compare?: number[];
  color?: string;
  height?: number;
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  compareLabel?: string;
};

const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

export function TrendChart({
  labels,
  values,
  compare,
  color = "var(--c1)",
  height = 270,
  formatValue,
  formatAxis,
  compareLabel = "Previous period",
}: TrendChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const count = values.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const max = niceCeil(Math.max(...values, ...(compare ?? []), 0));
  const x = (i: number) => PAD.left + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const points = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = smoothPath(points);
  const area = points.length > 1 ? `${line} L${x(count - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const compareLine = compare && compare.length === count ? smoothPath(compare.map((v, i) => ({ x: x(i), y: y(v) }))) : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(innerW / 70))));
  // Re-key the drawing so the line animation replays whenever the data changes.
  const drawKey = `${count}-${values.join(",")}`;

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (count === 0 || innerW <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left - PAD.left;
    const index = count <= 1 ? 0 : Math.round((relative / innerW) * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, index)));
  };

  return (
    <div ref={wrapRef} className="lx-chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={handleMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Revenue trend chart">
          <defs>
            <linearGradient id={`fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          <g className="grid">
            {ticks.map((tick) => <line key={tick} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />)}
          </g>
          <g className="axis">
            {ticks.map((tick) => (
              <text key={tick} x={PAD.left - 10} y={y(tick) + 4} textAnchor="end">{formatAxis(tick)}</text>
            ))}
            {labels.map((label, i) => (i % labelEvery === 0 || i === count - 1) && (
              <text key={`${label}-${i}`} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}>{label}</text>
            ))}
          </g>

          <g key={drawKey}>
            {compareLine && <path className="line-compare" d={compareLine} />}
            {area && <path className="area" d={area} fill={`url(#fill-${gradientId})`} />}
            <path className="line" d={line} stroke={color} pathLength={1} />
          </g>

          {hover !== null && (
            <g>
              <line className="cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />
              {compare && compare[hover] !== undefined && <circle className="dot" cx={x(hover)} cy={y(compare[hover])} r={3.5} stroke="var(--text-xsoft)" />}
              <circle className="dot" cx={x(hover)} cy={y(values[hover])} r={5} stroke={color} />
            </g>
          )}
        </svg>
      )}

      {hover !== null && width > 0 && (
        <div className="lx-tooltip" style={{ left: Math.min(Math.max(x(hover), 80), width - 80) }}>
          <div className="lx-tooltip-label">{labels[hover]}</div>
          <div className="lx-tooltip-value">{formatValue(values[hover])}</div>
          {compare && compare[hover] !== undefined && (
            <div className="lx-tooltip-compare">{compareLabel}: {formatValue(compare[hover])}</div>
          )}
        </div>
      )}
    </div>
  );
}
