'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorLine, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Table { id: string; number: number; label: string | null; isActive: boolean; url: string }

export default function TablesAdmin() {
  const { me, branches } = useStaff();
  const [branchId, setBranchId] = useState(me.branchId ?? '');
  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branches, branchId]);
  const list = useLoad<{ tables: Table[] }>(branchId ? `/api/staff/branches/${branchId}/tables` : null);
  const [num, setNum] = useState('');
  const { busy, error, run } = useAction();
  const tables = list.data?.tables ?? [];
  return (
    <>
      <div className="adm-top">
        <h1>میزها و QR</h1><span className="spacer" />
        {branchId ? <Link className="btn" href={`/admin/tables/print?branch=${branchId}`}>چاپ برگه‌ی QR</Link> : null}
      </div>
      <div className="filters">
        {me.role === 'OWNER' ? <label className="field"><span>شعبه</span><select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}</select></label> : null}
        <label className="field"><span>شماره‌ی میز جدید</span><input className="input num" type="number" min={1} max={999} value={num} onChange={(e) => setNum(e.target.value)} /></label>
        <button type="button" className="btn" disabled={busy || !num} onClick={() => void run(async () => { await api(`/api/staff/branches/${branchId}/tables`, { method: 'POST', json: { number: Number(num) } }); setNum(''); await list.reload(); })}>افزودن میز</button>
      </div>
      <ErrorLine error={error ?? list.error} />
      <p className="muted tiny" style={{ marginBottom: 12 }}>اگر کد یک میز کپی یا سوءاستفاده شد، «کد تازه» بزنید؛ QR قبلی دیگر کار نمی‌کند و باید دوباره چاپ شود.</p>
      <div className="qrcards">
        {tables.map((t) => (
          <div className="qrcard" key={t.id} style={{ opacity: t.isActive ? 1 : 0.5 }}>
            <img className="q" src={`/api/staff/tables/${t.id}/qr.svg?v=${encodeURIComponent(t.url.slice(-6))}`} alt={`QR میز ${t.number}`} />
            <span className="n num">میز {t.number.toLocaleString('fa-IR')}</span>
            <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => confirm('کد این میز عوض شود؟ QR قبلی باطل می‌شود.') && void run(async () => { await api(`/api/staff/tables/${t.id}/rotate`, { method: 'POST', json: {} }); await list.reload(); })}>کد تازه</button>
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run(async () => { await api(`/api/staff/tables/${t.id}`, { method: 'PATCH', json: { isActive: !t.isActive } }); await list.reload(); })}>{t.isActive ? 'غیرفعال' : 'فعال'}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
