'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatToman, type Locale } from '@tada/shared';

const ART = new Set(['hand', 'glass', 'glass2', 'leaf', 'cup', 'coffeeCup', 'icedCup', 'croissant', 'cookie', 'cookies', 'biscuit', 'beans', 'kettle', 'espresso', 'grinder', 'teapot', 'lemon', 'lemonArch', 'citrus', 'pear', 'pitaya', 'scooter', 'map', 'sun', 'hat', 'notes', 'palm', 'wheat', 'arch']);

/** A Tada line illustration, colored by `color` (CSS currentColor). */
export function Art({ name, className = '', style, label }: { name: string | null | undefined; className?: string; style?: CSSProperties; label?: string }) {
  const n = name && ART.has(name) ? name : 'cup';
  return (
    <span
      className={`art ${className}`}
      style={{ ['--art' as string]: `url(/art/${n}.svg)`, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function Money({ rial, locale }: { rial: number; locale: Locale }) {
  return <span className="num">{formatToman(rial, locale)}</span>;
}

export function Spinner() {
  return <span className="spin" aria-hidden />;
}

// ------------------------------------------------------------------ toast

const ToastCtx = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">{msg ? <div className="toast">{msg}</div> : null}</div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------ sheet (bottom sheet on phones, dialog on desktop)

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button, input, [href]')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <div className="grab" aria-hidden />
        {children}
      </div>
    </>
  );
}

export function Stepper({ value, onChange, min = 1, max = 20, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="+">+</button>
      <output aria-live="polite" className="num">{value}</output>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="−">−</button>
    </div>
  );
}
