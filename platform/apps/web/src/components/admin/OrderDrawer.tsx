'use client';
import { useEffect, useState } from 'react';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, STAFF_TRANSITIONS, canTransition, type OrderStatus } from '@tada/shared';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { Drawer, ErrorLine, faDate, toman, useAction, useStaff } from './kit';
import { printReceipt } from './receipt';

export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'warn', PLACED: 'bad', PREPARING: '', READY: 'ok', OUT_FOR_DELIVERY: '', COMPLETED: 'ok', CANCELLED: 'dark',
};

export function OrderDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged?: () => void }) {
  const { me } = useStaff();
  const [order, setOrder] = useState<Order | null>(null);
  const { busy, error, run } = useAction();

  const load = async (oid: string) => setOrder((await api<{ order: Order }>(`/api/staff/orders/${oid}`)).order);
  useEffect(() => {
    setOrder(null);
    if (id) void run(() => load(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const act = async (path: string, body: unknown = {}) => {
    const ok = await run(() => api(`/api/staff/orders/${id}${path}`, { method: 'POST', json: body }));
    if (ok !== undefined && id) {
      await load(id);
      onChanged?.();
    }
  };

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={order ? `سفارش #${order.number.toLocaleString('fa-IR')}` : 'سفارش'} actions={order ? <button type="button" className="btn ghost sm" onClick={() => printReceipt(order)}>چاپ فیش</button> : null}>
      <ErrorLine error={error} />
      {!order ? <div className="skeleton" style={{ height: 300 }} /> : (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className={`badge ${STATUS_TONE[order.status]}`}>{ORDER_STATUS_LABELS[order.status].fa}</span>
            <span className="badge">{ORDER_TYPE_LABELS[order.type].fa}{order.table ? ` · میز ${order.table.number.toLocaleString('fa-IR')}` : ''}</span>
            <span className={`badge ${order.paymentStatus === 'PAID' ? 'ok' : 'warn'}`}>{PAYMENT_METHOD_LABELS[order.paymentMethod].fa} · {PAYMENT_STATUS_LABELS[order.paymentStatus].fa}</span>
            <span className="muted tiny">{order.branch.nameFa} · {faDate(order.createdAt)}</span>
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <h2>اقلام</h2>
            {order.items.map((i) => (
              <div key={i.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'start', padding: '4px 0' }}>
                <span>
                  <b className="num">{i.quantity.toLocaleString('fa-IR')} ×</b> {i.nameFa}
                  {i.options.length ? <small className="muted" style={{ display: 'block' }}>{i.options.map((o) => o.nameFa).join(' · ')}</small> : null}
                  {i.note ? <small style={{ display: 'block', color: 'var(--tada)' }}>«{i.note}»</small> : null}
                </span>
                <span className="num">{toman(i.lineTotal)}</span>
              </div>
            ))}
            <div className="summary" style={{ marginTop: 10 }}>
              <div className="r"><span>جمع اقلام</span><span className="num">{toman(order.subtotal)}</span></div>
              {order.discountTotal ? <div className="r disc"><span>تخفیف</span><span className="num">− {toman(order.discountTotal)}</span></div> : null}
              {order.deliveryFee ? <div className="r"><span>ارسال</span><span className="num">{toman(order.deliveryFee)}</span></div> : null}
              <div className="r total"><span>مبلغ نهایی</span><span className="num">{toman(order.total)}</span></div>
            </div>
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <h2>مشتری</h2>
            <p>{order.customerName} {order.customerPhone ? <a href={`tel:${order.customerPhone}`} className="num" dir="ltr">{order.customerPhone}</a> : null}</p>
            {order.addressText ? <p className="muted">{order.addressText}{order.distanceKm !== null ? ` · ${order.distanceKm.toLocaleString('fa-IR')} کیلومتر` : ''}</p> : null}
            {order.location ? <a className="btn ghost sm" style={{ width: 'fit-content' }} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`}>مسیریابی</a> : null}
            {order.note ? <p className="alert" style={{ marginTop: 8 }}>یادداشت: {order.note}</p> : null}
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <h2>اقدام</h2>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {STAFF_TRANSITIONS[order.status].filter((s) => canTransition(order.status, s, order.type)).map((s) => (
                <button
                  type="button" key={s} disabled={busy}
                  className={`btn sm ${s === 'CANCELLED' ? 'danger' : ''}`}
                  onClick={() => (s === 'CANCELLED' && !confirm('این سفارش لغو شود؟') ? undefined : void act('/status', { status: s }))}
                >{ORDER_STATUS_LABELS[s].fa}</button>
              ))}
              {order.paymentStatus === 'UNPAID' && order.paymentMethod !== 'ONLINE' && order.status !== 'CANCELLED' ? (
                <button type="button" className="btn sm soft" disabled={busy} onClick={() => void act('/mark-paid')}>پرداخت شد</button>
              ) : null}
              {order.status === 'CANCELLED' && order.paymentStatus === 'PAID' && me.role !== 'BARISTA' ? (
                <button type="button" className="btn sm soft" disabled={busy} onClick={() => confirm('مبلغ به مشتری برگشت داده شد؟') && void act('/refunded')}>ثبت بازگشت وجه</button>
              ) : null}
            </div>
            {order.status === 'CANCELLED' && order.paymentStatus === 'PAID' ? <p className="alert warn" style={{ marginTop: 8 }}>این سفارش پرداخت آنلاین شده و لغو شده است؛ وجه را برگردانید و ثبت کنید.</p> : null}
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <h2>تاریخچه</h2>
            {order.events.map((e, i) => (
              <p key={i} className="tiny"><span className="num muted">{faDate(e.createdAt)}</span> — {ORDER_STATUS_LABELS[e.status].fa}{e.note ? ` (${e.note})` : ''}</p>
            ))}
            {order.payments?.length ? (
              <>
                <h2 style={{ marginTop: 12 }}>تراکنش‌ها</h2>
                {order.payments.map((p, i) => (
                  <p key={i} className="tiny"><span className="num">{faDate(p.createdAt)}</span> · {p.provider} · {p.status}{p.refId ? ` · کد پیگیری ${p.refId}` : ''}{p.cardPan ? ` · ${p.cardPan}` : ''}{p.error ? ` · ${p.error}` : ''}</p>
                ))}
              </>
            ) : null}
          </div>
        </div>
      )}
    </Drawer>
  );
}
