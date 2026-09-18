"use client";

import { useEffect, useRef } from "react";

interface SparkBarProps {
  values: number[];
  color: string;
}

export function SparkBar({ values, color }: SparkBarProps) {
  const max = Math.max(...values, 1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return;
      const targetPct = (values[i] / max) * 100;
      // Start from 0
      el.style.height = "0%";
      el.style.opacity = "0";
      // Animate to final value with staggered delay
      const delay = i * 60;
      const timer = setTimeout(() => {
        el.style.height = `${targetPct}%`;
        el.style.opacity = "0.9";
      }, delay);
      return () => clearTimeout(timer);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="spark-bar">
      {values.map((_, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="spark-bar-col"
          style={{
            height: "0%",
            opacity: 0,
            background: color,
            transition: "height 0.5s ease, opacity 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}
