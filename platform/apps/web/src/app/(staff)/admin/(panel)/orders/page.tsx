'use client';
import { useState } from 'react';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_TYPES, ORDER_TYPE_LABELS, PAYMENT_STATUS_LABELS } from '@tada/shared';
import type { Order } from '@/lib/types';
import { Pager, faDate, toman, useLoad, useStaff, ErrorLine } from '@/components/admin/kit';
import { OrderDrawer, STATUS_TONE } from '@/components/admin/OrderDrawer';

export default function OrdersPage() {
  const { me, branches } = useStaff();
  const [f, setF] = useState({ branchId: '', status: '', type: '', q: '', from: '', to: '', page: 1 });
  const qs = new URLSearchParams(Object.entries({ ...f, page: String(f.page), pageSize: '30' }).filter(([, v]) => v) as [string, string][]);
  const list = useLoad<{ orders: Order[]; total: number; page: number; pageSize: number }>(`/api/staff/orders?${qs}`);
  const [open, setOpen] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v, page: 1 });
  return (
    <>
      <div className="adm-top"><h1>سفارش‌ها</h1><span className="spacer" /><button type="button" className="btn ghost sm" onClick={() => void list.reload()}>به‌روزرسانی</button></div>
      <div className="filters">
        {me.role === 'OWNER' ? (
          <label className="field"><span>شعبه</span><select className="select" value={f.branchId} onChange={(e) => set('branchId', e.target.value)}><option value="">همه</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}</select></label>
        ) : null}
        <label className="field"><span>وضعیت</span><select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">همه</option><option value="ACTIVE">در جریان</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s].fa}</option>)}</select></label>
        <label className="field"><span>نوع</span><select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="">همه</option>{ORDER_TYPES.map((s) => <option key={s} value={s}>{ORDER_TYPE_LABELS[s].fa}</option>)}</select></label>
        <label className="field"><span>از</span><input className="input" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
        <label className="field"><span>تا</span><input className="input" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
        <label className="field"><span>جست‌وجو</span><input className="input" placeholder="شماره، نام یا موبایل" value={f.q} onChange={(e) => set('q', e.target.value)} /></label>
      </div>
      <ErrorLine error={list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>#</th><th>نوع</th><th>مشتری</th><th>شعبه</th><th>وضعیت</th><th>پرداخت</th><th className="end">مبلغ</th><th>زمان</th></tr></thead>
          <tbody>
            {list.data?.orders.map((o) => (
              <tr key={o.id} className="click" onClick={() => setOpen(o.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o.id)}>
                <td className="num">{o.number.toLocaleString('fa-IR')}</td>
                <td>{ORDER_TYPE_LABELS[o.type].fa}{o.table ? ` · میز ${o.table.number.toLocaleString('fa-IR')}` : ''}</td>
                <td>{o.customerName}<br /><small className="muted num" dir="ltr">{o.customerPhone ?? ''}</small></td>
                <td>{o.branch.nameFa}</td>
                <td><span className={`badge ${STATUS_TONE[o.status]}`}>{ORDER_STATUS_LABELS[o.status].fa}</span></td>
                <td><span className={`badge ${o.paymentStatus === 'PAID' ? 'ok' : 'warn'}`}>{PAYMENT_STATUS_LABELS[o.paymentStatus].fa}</span></td>
                <td className="end num">{toman(o.total)}</td>
                <td className="tiny muted">{faDate(o.createdAt)}</td>
              </tr>
            ))}
            {list.data && !list.data.orders.length ? <tr><td colSpan={8} className="muted">سفارشی پیدا نشد.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => setF({ ...f, page: p })} /> : null}
      <OrderDrawer id={open} onClose={() => setOpen(null)} onChanged={() => void list.reload()} />
    </>
  );
}
