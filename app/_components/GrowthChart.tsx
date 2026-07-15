"use client";

import { useEffect, useRef, useState } from "react";
import type { GrowthPoint } from "@/lib/db";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function niceStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= rough) return m * pow;
  }
  return 10 * pow;
}

export function GrowthChart({
  title,
  series,
  points,
  kind,
}: {
  title: string;
  series: "players" | "projects" | "violations";
  points: GrowthPoint[];
  kind: "cumulative" | "daily";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const values = points.map((p) => (kind === "cumulative" ? p.total : p.added));
  const maxVal = Math.max(...values, 0);
  const step = niceStep(maxVal);
  const yMax = Math.max(Math.ceil(maxVal / step), 1) * step;
  const ticks: number[] = [];
  for (let t = step; t <= yMax; t += step) ticks.push(t);

  const H = 200;
  const top = 18;
  const bottom = 26;
  const left = 8 + fmt(yMax).length * 7;
  const right = 14;
  const plotW = Math.max(width - left - right, 1);
  const plotH = H - top - bottom;
  const color = `var(--chart-${series})`;

  const x = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => top + plotH * (1 - v / yMax);
  const band = plotW / Math.max(n, 1);
  const bw = Math.max(Math.min(24, band - 2), 1);
  const bx = (i: number) => left + i * band + (band - bw) / 2;

  const indexAt = (clientX: number, rect: DOMRect): number => {
    const px = clientX - rect.left;
    const i =
      kind === "daily"
        ? Math.floor((px - left) / band)
        : Math.round(((px - left) / plotW) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const barPath = (i: number): string => {
    const v = values[i];
    const h = (v / yMax) * plotH;
    const r = Math.min(4, bw / 2, h);
    const xl = bx(i);
    const yt = y(v);
    const yb = y(0);
    return `M${xl},${yb} L${xl},${yt + r} Q${xl},${yt} ${xl + r},${yt} L${xl + bw - r},${yt} Q${xl + bw},${yt} ${xl + bw},${yt + r} L${xl + bw},${yb} Z`;
  };

  const xLabels = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const last = n - 1;
  const tooltipW = 150;
  const hoverX = hover === null ? 0 : kind === "daily" ? bx(hover) + bw / 2 : x(hover);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="font-pixel text-xl text-ink">{title}</div>
        <div className="text-xs text-ink/50">
          {kind === "cumulative" ? "total over time" : "per day"}
        </div>
      </div>
      <div
        ref={wrapRef}
        className="relative"
        style={{
          transition: "opacity 0.5s ease, transform 0.5s ease",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "none" : "translateY(8px)",
        }}
      >
        {width > 0 && n > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`${title}: ${fmt(values[last])}${kind === "cumulative" ? " total" : ` on ${dateLabel(points[last].date)}`}`}
            tabIndex={0}
            className="block outline-none focus-visible:outline-2 focus-visible:outline-brand"
            onPointerMove={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const d = e.key === "ArrowLeft" ? -1 : 1;
                setHover((h) => Math.max(0, Math.min(n - 1, (h ?? last) + d)));
              } else if (e.key === "Escape") {
                setHover(null);
              }
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--chart-text)">
                  {fmt(t)}
                </text>
              </g>
            ))}
            <line x1={left} x2={left + plotW} y1={y(0)} y2={y(0)} stroke="var(--chart-cross)" strokeWidth="1" />

            {kind === "cumulative" ? (
              <>
                <path d={areaPath} fill={color} fillOpacity="0.1" />
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && (
                  <line
                    x1={hoverX}
                    x2={hoverX}
                    y1={top}
                    y2={y(0)}
                    stroke="var(--chart-cross)"
                    strokeWidth="1"
                    style={{ transition: "x1 0.12s ease, x2 0.12s ease" }}
                  />
                )}
                {hover !== null && hover !== last && (
                  <circle
                    cx={x(hover)}
                    cy={y(values[hover])}
                    r="4"
                    fill={color}
                    stroke="var(--chart-surface)"
                    strokeWidth="2"
                    style={{ transition: "cx 0.12s ease, cy 0.12s ease" }}
                  />
                )}
                <circle cx={x(last)} cy={y(values[last])} r="4" fill={color} stroke="var(--chart-surface)" strokeWidth="2" />
                <text
                  x={x(last) - 8}
                  y={Math.max(y(values[last]) - 8, 12)}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="700"
                  fill="currentColor"
                >
                  {fmt(values[last])}
                </text>
              </>
            ) : (
              points.map((p, i) =>
                values[i] > 0 ? (
                  <path
                    key={p.date}
                    d={barPath(i)}
                    fill={color}
                    style={{
                      filter: hover === i ? "brightness(1.15)" : undefined,
                      transition: "filter 0.12s ease",
                    }}
                  />
                ) : null,
              )
            )}

            {xLabels.map((i, k) => (
              <text
                key={i}
                x={kind === "daily" ? bx(i) + bw / 2 : x(i)}
                y={H - 8}
                textAnchor={k === 0 ? "start" : k === xLabels.length - 1 ? "end" : "middle"}
                fontSize="10"
                fill="var(--chart-text)"
              >
                {dateLabel(points[i].date)}
              </text>
            ))}
          </svg>
        )}

        {hover !== null && n > 0 && (
          <div
            className="absolute top-1 pointer-events-none rounded-lg border border-[var(--line)] shadow-sm bg-[var(--surface)] px-2.5 py-1.5 text-xs z-10"
            style={{ left: Math.max(0, Math.min(hoverX + 10, width - tooltipW)) }}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5" style={{ background: color }} />
              <span className="font-bold text-sm">{fmt(values[hover])}</span>
              <span className="text-ink/60">{title.toLowerCase()}</span>
            </div>
            <div className="text-ink/50">{dateLabel(points[hover].date)}</div>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer font-bold text-ink/50 select-none">data table</summary>
        <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--line)]">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-parch">
                <th className="px-2 py-1">Date</th>
                <th className="px-2 py-1 text-right">{kind === "cumulative" ? "Total" : "Count"}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p, i) => (
                <tr key={p.date}>
                  <td className="px-2 py-1">{dateLabel(p.date)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(values[n - 1 - i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
