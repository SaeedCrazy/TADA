'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@tada/shared';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { Switch, faDate, toman, useAction, useLoad, useStaff, ErrorLine } from '@/components/admin/kit';
import { OrderDrawer, STATUS_TONE } from '@/components/admin/OrderDrawer';

export default function Dashboard() {
  const { me, branches, reloadBranches } = useStaff();
  const today = useLoad<{ orders: number; revenue: number; active: number; waiting: number }>('/api/staff/reports/today');
  const recent = useLoad<{ orders: Order[] }>('/api/staff/orders?pageSize=8');
  const [open, setOpen] = useState<string | null>(null);
  const { error, run } = useAction();
  return (
    <>
      <div className="adm-top"><h1>سلام {me.name}</h1><span className="spacer" /><Link className="btn" href="/bar">صفحه‌ی بار</Link></div>
      <div className="kpis">
        <div className="kpi"><span className="k">فروش امروز</span><span className="v num">{today.data ? toman(today.data.revenue) : '…'}</span><span className="s">سفارش‌های پرداخت‌شده</span></div>
        <div className="kpi"><span className="k">سفارش‌های پرداخت‌شده</span><span className="v num">{today.data?.orders.toLocaleString('fa-IR') ?? '…'}</span></div>
        <div className="kpi"><span className="k">در جریان</span><span className="v num">{today.data?.active.toLocaleString('fa-IR') ?? '…'}</span><span className="s">روی صفحه‌ی بار</span></div>
        <div className="kpi"><span className="k">منتظر شروع</span><span className="v num" style={{ color: today.data?.waiting ? 'var(--bad)' : undefined }}>{today.data?.waiting.toLocaleString('fa-IR') ?? '…'}</span></div>
      </div>
      {me.role !== 'BARISTA' ? (
        <div className="panel">
          <h2>سفارش آنلاین شعبه‌ها</h2>
          <ErrorLine error={error} />
          <div className="stack">
            {branches.map((b) => (
              <div key={b.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span><b>{b.nameFa}</b> <span className={`badge ${b.open.open ? 'ok' : 'warn'}`}>{b.open.open ? `باز تا ${b.open.closesAt}` : `بسته · ${b.open.opensAt}`}</span></span>
                <Switch checked={b.acceptsOrders} label={b.acceptsOrders ? 'سفارش می‌گیرد' : 'متوقف'} onChange={(v) => void run(async () => { await api(`/api/staff/branches/${b.id}/ordering`, { method: 'PATCH', json: { acceptsOrders: v } }); await reloadBranches(); })} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="panel">
        <h2>آخرین سفارش‌ها <span className="spacer" /><Link className="btn ghost sm" href="/admin/orders">همه</Link></h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>#</th><th>نوع</th><th>مشتری</th><th>شعبه</th><th>وضعیت</th><th className="end">مبلغ</th><th>زمان</th></tr></thead>
            <tbody>
              {recent.data?.orders.map((o) => (
                <tr key={o.id} className="click" onClick={() => setOpen(o.id)}>
                  <td className="num">{o.number.toLocaleString('fa-IR')}</td>
                  <td>{ORDER_TYPE_LABELS[o.type].fa}</td>
                  <td>{o.customerName}</td>
                  <td>{o.branch.nameFa}</td>
                  <td><span className={`badge ${STATUS_TONE[o.status]}`}>{ORDER_STATUS_LABELS[o.status].fa}</span></td>
                  <td className="end num">{toman(o.total)}</td>
                  <td className="tiny muted">{faDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <OrderDrawer id={open} onClose={() => setOpen(null)} onChanged={() => { void recent.reload(); void today.reload(); }} />
    </>
  );
}
