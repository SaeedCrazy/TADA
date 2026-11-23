'use client';
// Single-series charts for the sales report, following the dataviz rules: one hue, thin marks
// (<= 24px, 4px rounded data-end, square at the baseline), hairline solid grid, hover + focus
// tooltips (value first), and a table view so nothing depends on hovering.
import { useId, useState, type KeyboardEvent } from 'react';

const MARK = '#662482';
const MARK_HOVER = '#8A4FA8';
const GRID = '#E4DAE9';
const TEXT_MUTED = '#5E4A68';

const fa = (n: number) => n.toLocaleString('fa-IR');

/** Compact toman for axis ticks: 1,250,000 rial -> "۱۲۵ هزار". */
export function compactToman(rial: number): string {
  const t = rial / 10;
  if (t >= 1e9) return `${fa(Math.round((t / 1e9) * 10) / 10)} میلیارد`;
  if (t >= 1e6) return `${fa(Math.round((t / 1e6) * 10) / 10)} میلیون`;
  if (t >= 1e3) return `${fa(Math.round(t / 1e3))} هزار`;
  return fa(Math.round(t));
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Bar path with a 4px rounded top and a square base. */
function colPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export interface Datum { key: string; label: string; value: number }

export function ColumnChart({ data, format, axisFormat, title, height = 220, labelEvery = 1, integer = false }: {
  data: Datum[]; format: (v: number) => string; axisFormat: (v: number) => string; title: string; height?: number; labelEvery?: number; integer?: boolean;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const padL = 64;
  const padB = 28;
  const padT = 10;
  const plotH = height - padB - padT;
  const top = Math.max(0, ...data.map((d) => d.value));
  const max = integer && top <= 4 ? Math.max(1, Math.ceil(top)) : niceMax(top);
  const band = (W - padL - 8) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(24, band - 2));
  const ticks = integer && max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); (e.currentTarget.parentNode?.children[Math.min(data.length - 1, i + 1)] as SVGElement | undefined)?.focus(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); (e.currentTarget.parentNode?.children[Math.max(0, i - 1)] as SVGElement | undefined)?.focus(); }
  };
  const h = hover !== null ? data[hover] : null;
  const hx = hover !== null ? padL + band * hover + band / 2 : 0;

  if (top === 0) {
    return <p className="muted" style={{ padding: '28px 0', textAlign: 'center' }}>در این بازه هنوز داده‌ای ثبت نشده.</p>;
  }
  return (
    <figure style={{ margin: 0, position: 'relative' }} aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="sr-only">{title}</figcaption>
      <div dir="ltr" style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={title} style={{ overflow: 'visible', display: 'block' }}>
          {ticks.map((t) => {
            const y = padT + plotH - (t / max) * plotH;
            return (
              <g key={t}>
                <line x1={padL} x2={W} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill={TEXT_MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>{axisFormat(t)}</text>
              </g>
            );
          })}
          <g>
            {data.map((d, i) => {
              const bh = (d.value / max) * plotH;
              const x = padL + band * i + (band - bw) / 2;
              const y = padT + plotH - bh;
              return (
                <g
                  key={d.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onKeyDown={(e) => onKey(e, i)}
                  style={{ outline: 'none', cursor: 'default' }}
                >
                  <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" />
                  {bh > 0 ? <path d={colPath(x, y, bw, bh)} fill={hover === i ? MARK_HOVER : MARK} /> : null}
                </g>
              );
            })}
          </g>
          {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={`l-${d.key}`} x={padL + band * i + band / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={TEXT_MUTED}>{d.label}</text>
          ) : null))}
          {data.length && data[peak]!.value > 0 && hover === null ? (
            <text x={padL + band * peak + band / 2} y={padT + plotH - (data[peak]!.value / max) * plotH - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2A1236">{axisFormat(data[peak]!.value)}</text>
          ) : null}
        </svg>
        {h ? (
          <div role="status" style={{
            position: 'absolute', top: 0, left: `${(hx / W) * 100}%`, transform: 'translateX(-50%)', pointerEvents: 'none',
            background: '#1C0727', color: '#F6F0F8', borderRadius: 10, padding: '6px 10px', fontSize: 13, whiteSpace: 'nowrap', direction: 'rtl', boxShadow: '0 6px 20px rgba(28,7,39,.25)',
          }}>
            <b style={{ display: 'block', fontSize: 14 }}>{format(h.value)}</b>
            <span style={{ opacity: 0.8 }}>{h.label}</span>
          </div>
        ) : null}
      </div>
      <details style={{ marginTop: 6 }}>
        <summary className="tiny muted" style={{ cursor: 'pointer' }}>نمایش جدول</summary>
        <table className="tbl" style={{ marginTop: 6 }}>
          <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td className="end num">{format(d.value)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

/** Ranked horizontal bars with the value at the tip. */
export function BarList({ data, format, title }: { data: Datum[]; format: (v: number) => string; title: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="muted tiny">داده‌ای نیست.</p>;
  return (
    <div role="list" aria-label={title} className="stack" style={{ gap: 10 }}>
      {data.map((d) => (
        <div
          role="listitem" key={d.key} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}
          onPointerEnter={() => setHover(d.key)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(d.key)} onBlur={() => setHover(null)}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 32%) 1fr', gap: 10, alignItems: 'center', outline: 'none' }}
        >
          <span className="tiny" style={{ color: '#2A1236', fontWeight: 700 }}>{d.label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              height: 14, width: `${Math.max(1.5, (d.value / max) * 78)}%`, background: hover === d.key ? MARK_HOVER : MARK,
              borderStartEndRadius: 4, borderEndEndRadius: 4, transition: 'background .15s',
            }} />
            <span className="tiny num" style={{ color: TEXT_MUTED, whiteSpace: 'nowrap' }}>{format(d.value)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
