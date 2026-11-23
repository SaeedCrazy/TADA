'use client';
import { useState } from 'react';
import { ORDER_STATUS_LABELS } from '@tada/shared';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { Drawer, ErrorLine, Pager, Switch, faDate, toman, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Row { id: string; phone: string; name: string | null; createdAt: string; isBlocked: boolean; tasteConsent: boolean; _count: { orders: number } }
interface Detail extends Row { orders: Order[]; totalSpent: number; addresses: { id: string; title: string; line: string }[] }

export default function CustomersAdmin() {
  const { me } = useStaff();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad<{ customers: Row[]; total: number; page: number; pageSize: number }>(`/api/staff/customers?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useLoad<{ customer: Detail }>(openId ? `/api/staff/customers/${openId}` : null);
  const { error, run } = useAction();
  const c = detail.data?.customer;
  return (
    <>
      <div className="adm-top"><h1>مشتری‌ها</h1></div>
      <div className="filters"><label className="field"><span>جست‌وجو</span><input className="input" placeholder="نام یا موبایل" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label></div>
      <ErrorLine error={list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>نام</th><th>موبایل</th><th>سفارش‌ها</th><th>عضویت</th><th>وضعیت</th></tr></thead>
          <tbody>
            {list.data?.customers.map((x) => (
              <tr key={x.id} className="click" onClick={() => setOpenId(x.id)}>
                <td>{x.name ?? '—'}</td>
                <td className="num" dir="ltr" style={{ textAlign: 'end' }}>{x.phone}</td>
                <td className="num">{x._count.orders.toLocaleString('fa-IR')}</td>
                <td className="tiny">{faDate(x.createdAt, false)}</td>
                <td>{x.isBlocked ? <span className="badge bad">مسدود</span> : <span className="badge ok">فعال</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
      <Drawer open={Boolean(openId)} onClose={() => setOpenId(null)} title={c?.name ?? c?.phone ?? 'مشتری'}>
        <ErrorLine error={error ?? detail.error} />
        {c ? (
          <div className="stack">
            <div className="kpis">
              <div className="kpi"><span className="k">مجموع خرید</span><span className="v num">{toman(c.totalSpent)}</span></div>
              <div className="kpi"><span className="k">سفارش‌ها</span><span className="v num">{c.orders.length.toLocaleString('fa-IR')}</span></div>
            </div>
            <p className="num" dir="ltr" style={{ textAlign: 'end' }}>{c.phone}</p>
            {me.role === 'OWNER' ? <Switch checked={c.isBlocked} label="مسدود (نمی‌تواند وارد شود یا سفارش دهد)" onChange={(v) => void run(async () => { await api(`/api/staff/customers/${c.id}`, { method: 'PATCH', json: { isBlocked: v } }); await detail.reload(); await list.reload(); })} /> : null}
            <div className="panel" style={{ margin: 0 }}>
              <h2>سفارش‌ها</h2>
              {c.orders.map((o) => (
                <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                  <span className="num">#{o.number.toLocaleString('fa-IR')}</span>
                  <span className="badge">{ORDER_STATUS_LABELS[o.status].fa}</span>
                  <span className="num">{toman(o.total)}</span>
                  <span className="tiny muted">{faDate(o.createdAt)}</span>
                </div>
              ))}
            </div>
            {c.addresses.length ? <div className="panel" style={{ margin: 0 }}><h2>آدرس‌ها</h2>{c.addresses.map((a) => <p key={a.id} className="tiny"><b>{a.title}</b>: {a.line}</p>)}</div> : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
