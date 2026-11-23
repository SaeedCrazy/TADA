'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Art } from '@/components/ui';
import { ErrorLine, Switch, TomanInput, toman, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Item { id: string; nameFa: string; basePrice: number; art: string | null; isAvailable: boolean; stock: number | null; priceOverride: number | null }

export default function AvailabilityPage() {
  const { me, branches } = useStaff();
  const [branchId, setBranchId] = useState(me.branchId ?? '');
  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branches, branchId]);
  const list = useLoad<{ items: Item[] }>(branchId ? `/api/staff/branches/${branchId}/availability` : null);
  const { error, run } = useAction();
  const save = (id: string, patch: Partial<Item>) =>
    run(async () => {
      await api(`/api/staff/branches/${branchId}/availability/${id}`, { method: 'PUT', json: patch });
      list.setData((d) => (d ? { items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : d));
    });
  return (
    <>
      <div className="adm-top"><h1>موجودی شعبه</h1></div>
      <div className="filters">
        {me.role === 'OWNER' ? (
          <label className="field"><span>شعبه</span><select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}</select></label>
        ) : null}
        <p className="muted tiny">کالای «تمام شد» در منوی همین شعبه غیرفعال می‌شود. خالی گذاشتن موجودی یعنی بدون شمارش.</p>
      </div>
      <ErrorLine error={error ?? list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th></th><th>محصول</th><th>موجود</th><th>تعداد موجودی</th>{me.role !== 'BARISTA' ? <th>قیمت این شعبه</th> : null}</tr></thead>
          <tbody>
            {list.data?.items.map((i) => (
              <tr key={i.id}>
                <td style={{ width: 40, color: 'var(--tada)' }}><Art name={i.art} style={{ width: 20, height: 26 }} /></td>
                <td>{i.nameFa}<br /><small className="muted num">{toman(i.basePrice)}</small></td>
                <td><Switch checked={i.isAvailable} label={i.isAvailable ? 'موجود' : 'تمام شد'} onChange={(v) => void save(i.id, { isAvailable: v })} /></td>
                <td style={{ maxWidth: 140 }}>
                  <input className="input num ltr" dir="ltr" inputMode="numeric" defaultValue={i.stock ?? ''} placeholder="—" aria-label={`موجودی ${i.nameFa}`}
                    onBlur={(e) => { const v = e.target.value.trim(); const n = v === '' ? null : Math.max(0, Number(v) || 0); if (n !== i.stock) void save(i.id, { stock: n }); }} />
                </td>
                {me.role !== 'BARISTA' ? (
                  <td style={{ maxWidth: 180 }}>
                    <TomanInput label="قیمت" allowNull value={i.priceOverride} onChange={(v) => list.setData((d) => (d ? { items: d.items.map((x) => (x.id === i.id ? { ...x, priceOverride: v } : x)) } : d))} />
                    <button type="button" className="btn ghost sm" onClick={() => void save(i.id, { priceOverride: list.data!.items.find((x) => x.id === i.id)!.priceOverride })}>ذخیره</button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
