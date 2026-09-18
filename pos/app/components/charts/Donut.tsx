"use client";

import { useEffect, useState } from "react";

interface DonutProps {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  label: string;
  sublabel: string;
}

export function Donut({ pct, color, size = 80, stroke = 10, label, sublabel }: DonutProps) {
  const [animated, setAnimated] = useState(false);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const cx = size / 2;

  // Trigger animation after mount so SSR/first-paint shows empty arc, then animates
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} className="donut-svg">
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--panel-border)" strokeWidth={stroke} />
        {/* Arc — animated via strokeDashoffset transition */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={animated ? circ - dash : circ}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">{pct}%</text>
        <text x={cx} y={cx + 12} textAnchor="middle" fontSize="8" fill="var(--text-soft)">{sublabel}</text>
      </svg>
      <span className="donut-label">{label}</span>
    </div>
  );
}
