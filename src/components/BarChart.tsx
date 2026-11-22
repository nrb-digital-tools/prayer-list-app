import { useEffect, useRef, useState } from "preact/hooks";
import { formatMinutes, niceScale, type Bucket } from "../lib/stats";

// A single-series bar chart of minutes. One color (the accent), thin bars with a rounded top,
// quiet grid lines, one value label (the biggest bar), and a tooltip on hover or tap.
export function BarChart({ data, label }: { data: Bucket[]; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 210;
  const m = { top: 14, right: 8, bottom: 26, left: 34 };
  const innerW = width - m.left - m.right;
  const innerH = H - m.top - m.bottom;
  const max = Math.max(...data.map((d) => d.minutes), 0);
  const { top, step } = niceScale(max);
  const band = innerW / data.length;
  const barW = Math.max(4, Math.min(28, band - 4));
  const y = (v: number) => m.top + innerH - (v / top) * innerH;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const labelEvery = Math.ceil(24 / band); // keep x labels from colliding
  const maxIndex = max > 0 ? data.findIndex((d) => d.minutes === max) : -1;
  const h = hover !== null ? data[hover] : undefined;
  const tipLeft = hover !== null ? Math.min(Math.max(m.left + band * (hover + 0.5), 70), width - 70) : 0;

  return (
    <div class="chart" ref={wrap}>
      <svg width={width} height={H} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} class={t === 0 ? "axis" : "grid"} />
            <text x={m.left - 6} y={y(t) + 4} text-anchor="end" class="tick">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = m.left + band * (i + 0.5);
          const x0 = cx - barW / 2;
          const h0 = (d.minutes / top) * innerH;
          const r = Math.min(4, barW / 2, h0);
          const y0 = y(d.minutes);
          const base = y(0);
          return (
            <g key={d.start}>
              {d.minutes > 0 && (
                <path
                  class={hover === i ? "bar on" : "bar"}
                  d={`M${x0},${base} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${base} Z`}
                />
              )}
              {i === maxIndex && (
                <text x={cx} y={y0 - 5} text-anchor="middle" class="value">
                  {Math.round(d.minutes)}
                </text>
              )}
              {i % labelEvery === (data.length - 1) % labelEvery && (
                <text x={cx} y={H - 8} text-anchor="middle" class="tick">
                  {d.label}
                </text>
              )}
              {/* Bigger invisible target than the bar, so it is easy to tap. */}
              <rect
                x={m.left + band * i}
                y={m.top}
                width={band}
                height={innerH + m.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
      {h && (
        <div class="tip" style={{ left: `${tipLeft}px` }}>
          <strong>{h.full}</strong>
          <div>{formatMinutes(h.minutes)}</div>
          <div class="muted">{h.prayers} {h.prayers === 1 ? "prayer" : "prayers"}</div>
        </div>
      )}
    </div>
  );
}
