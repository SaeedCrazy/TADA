'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { STAFF_ROLE_LABELS } from '@tada/shared';
import { api } from '@/lib/api';
import { Art } from '@/components/ui';
import { StaffCtx, type AdminBranch, type StaffUser } from './kit';

const NAV: { href: string; label: string; art: string; roles: StaffUser['role'][] }[] = [
  { href: '/admin', label: 'داشبورد', art: 'sun', roles: ['OWNER', 'MANAGER', 'BARISTA'] },
  { href: '/bar', label: 'صفحه‌ی بار', art: 'espresso', roles: ['OWNER', 'MANAGER', 'BARISTA'] },
  { href: '/admin/orders', label: 'سفارش‌ها', art: 'cup', roles: ['OWNER', 'MANAGER', 'BARISTA'] },
  { href: '/admin/availability', label: 'موجودی شعبه', art: 'beans', roles: ['OWNER', 'MANAGER', 'BARISTA'] },
  { href: '/admin/menu', label: 'منو و محصولات', art: 'glass', roles: ['OWNER'] },
  { href: '/admin/branches', label: 'شعبه‌ها', art: 'map', roles: ['OWNER'] },
  { href: '/admin/tables', label: 'میزها و QR', art: 'glass2', roles: ['OWNER', 'MANAGER'] },
  { href: '/admin/discounts', label: 'کدهای تخفیف', art: 'notes', roles: ['OWNER', 'MANAGER'] },
  { href: '/admin/customers', label: 'مشتری‌ها', art: 'hand', roles: ['OWNER', 'MANAGER'] },
  { href: '/admin/reports', label: 'گزارش فروش', art: 'coffeePath', roles: ['OWNER', 'MANAGER'] },
  { href: '/admin/accounting', label: 'حسابداری', art: 'wheat', roles: ['OWNER'] },
  { href: '/admin/assistant', label: 'دستیار تادا', art: 'hat', roles: ['OWNER', 'MANAGER'] },
  { href: '/admin/staff', label: 'همکاران', art: 'teapot', roles: ['OWNER'] },
  { href: '/admin/audit', label: 'گزارش تغییرات', art: 'kettle', roles: ['OWNER'] },
  { href: '/admin/settings', label: 'تنظیمات', art: 'grinder', roles: ['OWNER', 'MANAGER', 'BARISTA'] },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<StaffUser | null>(null);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [open, setOpen] = useState(false);

  const reloadBranches = useCallback(async () => {
    const r = await api<{ branches: AdminBranch[] }>('/api/staff/branches');
    setBranches(r.branches);
  }, []);

  useEffect(() => {
    api<{ staff: StaffUser | null }>('/api/staff/me')
      .then(async (r) => {
        if (!r.staff) { router.replace(`/admin/login?next=${encodeURIComponent(path)}`); return; }
        setMe(r.staff);
        await reloadBranches();
      })
      .catch(() => router.replace('/admin/login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setOpen(false), [path]);

  if (!me) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><div className="skeleton" style={{ width: 220, height: 20 }} /></div>;

  return (
    <StaffCtx.Provider value={{ me, branches, reloadBranches }}>
      <div className="adm">
        <nav className={`adm-side${open ? ' open' : ''}`} aria-label="منوی پنل">
          <Link href="/admin" className="brand"><img src="/brand/tada-wordmark-fa_white.svg" alt="تادا" /><b>پنل</b></Link>
          {NAV.filter((n) => n.roles.includes(me.role)).map((n) => (
            <Link key={n.href} href={n.href} className="nav" aria-current={(n.href === '/admin' ? path === '/admin' : path.startsWith(n.href)) ? 'page' : undefined}>
              <Art name={n.art === 'coffeePath' ? 'notes' : n.art} />{n.label}
            </Link>
          ))}
          <div className="who">
            <span><b style={{ color: 'var(--cream)' }}>{me.name}</b> · {STAFF_ROLE_LABELS[me.role].fa}</span>
            <button type="button" className="btn ghost sm" style={{ color: 'var(--cream)', borderColor: 'rgba(195,173,207,.4)' }} onClick={async () => { await api('/api/staff/logout', { method: 'POST', json: {} }); router.replace('/admin/login'); }}>خروج</button>
          </div>
        </nav>
        {open ? <div className="scrim" onClick={() => setOpen(false)} aria-hidden style={{ zIndex: 69 }} /> : null}
        <div className="adm-main">
          <button type="button" className="btn ghost sm adm-burger no-print" onClick={() => setOpen(true)} aria-label="باز کردن منو" style={{ marginBottom: 12 }}>☰ منو</button>
          {children}
        </div>
      </div>
    </StaffCtx.Provider>
  );
}
