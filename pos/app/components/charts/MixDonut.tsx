"use client";

import { useEffect, useState } from "react";

export type DonutSegment = { label: string; value: number; color: string };

type MixDonutProps = {
  segments: DonutSegment[];
  centerLabel: string;
  formatValue: (value: number) => string;
  size?: number;
  stroke?: number;
};

/** Multi-segment donut that sweeps in on mount; hovering a slice or legend row focuses it. */
export function MixDonut({ segments, centerLabel, formatValue, size = 188, stroke = 20 }: MixDonutProps) {
  const [drawn, setDrawn] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - stroke) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.length > 1 ? 3 : 0;
  let offset = 0;

  const focus = active !== null ? segments[active] : null;

  return (
    <div className="lx-donut-wrap">
      <div className="lx-donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--panel-2)" strokeWidth={stroke} />
          {total > 0 && segments.map((segment, index) => {
            const length = (segment.value / total) * circumference;
            const visible = Math.max(0, length - gap);
            const start = offset;
            offset += length;
            return (
              <circle
                key={segment.label}
                className="seg"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={active === index ? stroke + 6 : stroke}
                strokeDasharray={drawn ? `${visible} ${circumference}` : `0 ${circumference}`}
                strokeDashoffset={-start}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                opacity={active === null || active === index ? 1 : 0.35}
                style={{ transitionDelay: drawn ? `${index * 90}ms` : "0ms" }}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="lx-donut-center">
          <strong>{focus ? `${total > 0 ? Math.round((focus.value / total) * 100) : 0}%` : formatValue(total)}</strong>
          <span>{focus ? focus.label : centerLabel}</span>
        </div>
      </div>

      <div className="lx-legend-list">
        {segments.map((segment, index) => (
          <div
            key={segment.label}
            className={`lx-legend-row${active === index ? " active" : ""}`}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            <i style={{ background: segment.color }} />
            <span className="name">{segment.label}</span>
            <span className="val">{formatValue(segment.value)}</span>
            <span className="pct">{total > 0 ? `${Math.round((segment.value / total) * 100)}%` : "0%"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
