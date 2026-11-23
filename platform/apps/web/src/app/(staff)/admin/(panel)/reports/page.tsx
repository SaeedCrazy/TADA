'use client';
import { useMemo, useState } from 'react';
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, type OrderType, type PaymentMethod } from '@tada/shared';
import { ErrorLine, toman, useLoad, useStaff } from '@/components/admin/kit';
import { BarList, ColumnChart, compactToman } from '@/components/admin/charts';

interface Summary {
  range: { from: string; to: string; branchId: string | null };
  totals: { orders: number; revenue: number; averageOrder: number; discounts: number; delivery: number; cancelled: number };
  byDay: { day: string; orders: number; revenue: number }[];
  byBranch: { branchId: string; nameFa: string; orders: number; revenue: number }[];
  byType: { type: string; orders: number; revenue: number }[];
  byPayment: { method: string; orders: number; revenue: number }[];
  topProducts: { productId: string; nameFa: string; quantity: number; revenue: number }[];
  byHour: { hour: number; orders: number }[];
}

const DAY = 86400_000;
const IRST = 210 * 60_000;
/** Midnight in Tehran, as a UTC Date. */
const tehranMidnight = (t: number) => new Date(Math.floor((t + IRST) / DAY) * DAY - IRST);
const PRESETS = [
  { key: 'today', label: 'امروز', days: 1 },
  { key: '7', label: '۷ روز', days: 7 },
  { key: '30', label: '۳۰ روز', days: 30 },
  { key: '90', label: '۹۰ روز', days: 90 },
];

function fillDays(from: Date, to: Date, rows: Summary['byDay']) {
  const out: { key: string; label: string; value: number; orders: number }[] = [];
  const map = new Map(rows.map((r) => [r.day, r]));
  for (let t = from.getTime(); t < to.getTime(); t += DAY) {
    const key = new Date(t + IRST).toISOString().slice(0, 10);
    const r = map.get(key);
    out.push({ key, label: new Date(t + 12 * 3600_000).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', month: 'numeric', day: 'numeric' }), value: r?.revenue ?? 0, orders: r?.orders ?? 0 });
  }
  return out;
}

export default function ReportsPage() {
  const { me, branches } = useStaff();
  const [preset, setPreset] = useState('7');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [branchId, setBranchId] = useState('');

  const { from, to } = useMemo(() => {
    if (preset === 'custom' && custom.from && custom.to) {
      return { from: tehranMidnight(new Date(custom.from).getTime() + IRST), to: new Date(tehranMidnight(new Date(custom.to).getTime() + IRST).getTime() + DAY) };
    }
    const days = PRESETS.find((p) => p.key === preset)?.days ?? 7;
    const end = new Date(tehranMidnight(Date.now()).getTime() + DAY);
    return { from: new Date(end.getTime() - days * DAY), to: end };
  }, [preset, custom]);

  const q = `/api/staff/reports/summary?from=${from.toISOString()}&to=${to.toISOString()}${branchId ? `&branchId=${branchId}` : ''}`;
  const r = useLoad<Summary>(q);
  const s = r.data;
  const days = s ? fillDays(from, to, s.byDay) : [];
  const hours = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: h.toLocaleString('fa-IR'), value: s?.byHour.find((x) => x.hour === h)?.orders ?? 0 }))
    .filter((_, h) => h >= 7 || (s?.byHour.some((x) => x.hour === h && x.orders > 0) ?? false));
  const fmtOrders = (v: number) => `${v.toLocaleString('fa-IR')} سفارش`;

  return (
    <>
      <div className="adm-top"><h1>گزارش فروش</h1></div>
      <div className="filters" role="group" aria-label="بازه‌ی گزارش">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((p) => <button key={p.key} type="button" className="chip" aria-pressed={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</button>)}
          <button type="button" className="chip" aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>بازه‌ی دلخواه</button>
        </div>
        {preset === 'custom' ? (
          <>
            <label className="field"><span>از</span><input className="input" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label className="field"><span>تا</span><input className="input" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
          </>
        ) : null}
        {me.role === 'OWNER' ? (
          <label className="field"><span>شعبه</span><select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">همه‌ی شعبه‌ها</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}</select></label>
        ) : null}
      </div>
      <ErrorLine error={r.error} />
      <div style={{ opacity: r.loading && s ? 0.55 : 1, transition: 'opacity .2s' }}>
        <div className="kpis">
          <div className="kpi"><span className="k">فروش</span><span className="v">{s ? toman(s.totals.revenue) : '…'}</span><span className="s">سفارش‌های پرداخت‌شده</span></div>
          <div className="kpi"><span className="k">تعداد سفارش</span><span className="v">{s ? s.totals.orders.toLocaleString('fa-IR') : '…'}</span></div>
          <div className="kpi"><span className="k">میانگین هر سفارش</span><span className="v">{s ? toman(s.totals.averageOrder) : '…'}</span></div>
          <div className="kpi"><span className="k">تخفیف داده‌شده</span><span className="v">{s ? toman(s.totals.discounts) : '…'}</span></div>
          <div className="kpi"><span className="k">لغوشده</span><span className="v">{s ? s.totals.cancelled.toLocaleString('fa-IR') : '…'}</span></div>
        </div>
        {s ? (
          <>
            <div className="panel">
              <h2>فروش روزانه (تومان)</h2>
              <ColumnChart title="فروش روزانه" data={days} format={toman} axisFormat={compactToman} labelEvery={Math.max(1, Math.ceil(days.length / 10))} />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              {me.role === 'OWNER' && !branchId ? (
                <div className="panel"><h2>فروش به تفکیک شعبه</h2><BarList title="فروش شعبه‌ها" data={s.byBranch.map((b) => ({ key: b.branchId, label: b.nameFa, value: b.revenue }))} format={toman} /></div>
              ) : null}
              <div className="panel"><h2>پرفروش‌ترین‌ها (تعداد)</h2><BarList title="پرفروش‌ترین محصولات" data={s.topProducts.map((p) => ({ key: p.productId, label: p.nameFa, value: p.quantity }))} format={(v) => `${v.toLocaleString('fa-IR')} عدد`} /></div>
              <div className="panel"><h2>نوع سفارش</h2><BarList title="فروش به تفکیک نوع سفارش" data={s.byType.map((x) => ({ key: x.type, label: ORDER_TYPE_LABELS[x.type as OrderType]?.fa ?? x.type, value: x.revenue }))} format={toman} /></div>
              <div className="panel"><h2>روش پرداخت</h2><BarList title="فروش به تفکیک روش پرداخت" data={s.byPayment.map((x) => ({ key: x.method, label: PAYMENT_METHOD_LABELS[x.method as PaymentMethod]?.fa ?? x.method, value: x.revenue }))} format={toman} /></div>
            </div>
            <div className="panel">
              <h2>سفارش در ساعت‌های روز (به وقت تهران)</h2>
              <ColumnChart title="سفارش در ساعت‌های روز" data={hours} format={fmtOrders} axisFormat={(v) => Math.round(v).toLocaleString('fa-IR')} height={180} integer />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
