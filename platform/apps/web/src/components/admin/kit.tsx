'use client';
// Small building blocks for the admin panel.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { formatToman } from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import { errorText } from '@/lib/i18n';

export interface StaffUser { id: string; username: string; name: string; role: 'OWNER' | 'MANAGER' | 'BARISTA'; branchId: string | null }
export interface AdminBranch { id: string; slug: string; nameFa: string; nameEn: string; acceptsOrders: boolean; open: { open: boolean; closesAt?: string; opensAt?: string; tomorrow?: boolean } }

export const StaffCtx = createContext<{ me: StaffUser; branches: AdminBranch[]; reloadBranches: () => Promise<void> } | null>(null);
export function useStaff() {
  const v = useContext(StaffCtx);
  if (!v) throw new Error('useStaff outside the admin shell');
  return v;
}

export const toman = (rial: number) => formatToman(rial, 'fa');
export const errFa = (e: unknown) => errorText('fa', isApiError(e) ? e.code : undefined);
export const faDate = (iso: string | Date, withTime = true) =>
  new Date(iso).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });

/** Loads JSON from the API and exposes reload. */
export function useLoad<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(errFa(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export function Drawer({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="head">
          <h2 style={{ fontSize: 19 }}>{title}</h2>
          <span className="spacer" />
          {actions}
          <button type="button" className="btn ghost sm" onClick={onClose}>بستن</button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
      <span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} /><span /></span>
      <span>{label}</span>
    </label>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button type="button" className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>قبلی</button>
      <span className="num tiny">{page.toLocaleString('fa-IR')} از {pages.toLocaleString('fa-IR')}</span>
      <button type="button" className="btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>بعدی</button>
    </div>
  );
}

/** Rial amounts are edited in toman. */
export function TomanInput({ value, onChange, label, allowNull = false }: { value: number | null; onChange: (rial: number | null) => void; label: string; allowNull?: boolean }) {
  return (
    <label className="field">
      <span>{label} (تومان)</span>
      <input
        className="input num ltr" dir="ltr" inputMode="numeric"
        value={value === null ? '' : String(Math.round(value / 10))}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
          onChange(raw === '' ? (allowNull ? null : 0) : Number(raw) * 10);
        }}
      />
    </label>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errFa(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}

export function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="alert bad" role="alert">{error}</p> : null;
}
