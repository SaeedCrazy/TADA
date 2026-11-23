'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, localizeDigits, type Locale, type OrderStatus } from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import type { Order } from '@/lib/types';
import { dict, errorText, href } from '@/lib/i18n';
import { Art, Money, Spinner } from '../ui';

const FLOW: Record<Order['type'], OrderStatus[]> = {
  DINE_IN: ['PLACED', 'PREPARING', 'READY', 'COMPLETED'],
  PICKUP: ['PLACED', 'PREPARING', 'READY', 'COMPLETED'],
  DELIVERY: ['PLACED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'],
};

export function OrderTracker({ locale, id, token, paid }: { locale: Locale; id: string; token: string | null; paid: string | null }) {
  const t = dict(locale);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const q = token ? `?t=${encodeURIComponent(token)}` : '';

  const load = useCallback(async () => {
    try {
      const r = await api<{ order: Order }>(`/api/orders/${id}${q}`);
      setOrder(r.order);
      setErr(null);
    } catch (e) {
      setErr(errorText(locale, isApiError(e) ? e.code : undefined));
    }
  }, [id, q, locale]);

  useEffect(() => {
    void load();
    const live = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 8000);
    return () => clearInterval(live);
  }, [load]);

  const retry = async () => {
    setPaying(true);
    try {
      const r = await api<{ payment: { redirectUrl: string } }>(`/api/orders/${id}/pay${q}`, { method: 'POST', json: {} });
      window.location.assign(r.payment.redirectUrl);
    } catch (e) {
      setErr(errorText(locale, isApiError(e) ? e.code : undefined));
      setPaying(false);
    }
  };

  if (!order) return err ? <p className="alert bad">{err}</p> : <div className="skeleton" style={{ height: 320 }} />;

  const L = (x: { nameFa: string; nameEn: string }) => (locale === 'fa' ? x.nameFa : x.nameEn);
  const flow = FLOW[order.type];
  const at = flow.indexOf(order.status);
  const time = (iso: string) => localizeDigits(new Date(iso).toLocaleTimeString(locale === 'fa' ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }), locale);

  return (
    <div className="cols">
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28 }}>{t.order.title(order.number)}</h1>
          <span className="badge">{ORDER_TYPE_LABELS[order.type][locale]}</span>
          {order.table ? <span className="badge">{t.order.table(order.table.number)}</span> : null}
        </div>
        {paid === '1' && order.paymentStatus === 'PAID' ? <p className="alert ok" role="status">{t.order.paidOk}</p> : null}
        {paid === '0' && order.status === 'PENDING_PAYMENT' ? <p className="alert bad" role="alert">{t.order.paidFail}</p> : null}
        {err ? <p className="alert bad">{err}</p> : null}

        {order.status === 'PENDING_PAYMENT' ? (
          <section className="section">
            <p>{ORDER_STATUS_LABELS.PENDING_PAYMENT[locale]}</p>
            <button type="button" className="btn" onClick={() => void retry()} disabled={paying}>{paying ? <Spinner /> : null}{t.order.retryPay}</button>
          </section>
        ) : order.status === 'CANCELLED' ? (
          <section className="section">
            <p className="alert warn">{order.events.some((e) => e.note === 'payment_timeout') ? t.order.expired : ORDER_STATUS_LABELS.CANCELLED[locale]}</p>
          </section>
        ) : (
          <section className="section" aria-labelledby="st">
            <h2 id="st">{t.order.status}</h2>
            <ol className="tracker">
              {flow.map((s, i) => {
                const ev = order.events.find((e) => e.status === s);
                return (
                  <li key={s} className={i < at || order.status === 'COMPLETED' ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
                    <span className="node" aria-hidden />
                    <span className="row" style={{ justifyContent: 'space-between' }}>
                      <span>{ORDER_STATUS_LABELS[s][locale]}</span>
                      {ev ? <small className="num muted">{time(ev.createdAt)}</small> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
            {order.status === 'COMPLETED' ? <p className="row" style={{ color: 'var(--tada)', fontWeight: 800 }}><Art name="hand" style={{ width: 22, height: 32 }} />{t.order.thanks}</p> : <p className="muted tiny">{t.order.live}</p>}
          </section>
        )}

        <section className="section" aria-labelledby="it">
          <h2 id="it">{t.order.items}</h2>
          {order.items.map((i) => (
            <div key={i.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'start' }}>
              <span>
                {localizeDigits(i.quantity, locale)} × {L(i)}
                {i.options.length ? <small className="muted" style={{ display: 'block' }}>{i.options.map(L).join(' · ')}</small> : null}
              </span>
              <Money rial={i.lineTotal} locale={locale} />
            </div>
          ))}
        </section>
      </div>
      <aside className="section">
        <div className="summary">
          <div className="r"><span>{t.cart.subtotal}</span><Money rial={order.subtotal} locale={locale} /></div>
          {order.discountTotal ? <div className="r disc"><span>{t.cart.discount}</span><span>− <Money rial={order.discountTotal} locale={locale} /></span></div> : null}
          {order.type === 'DELIVERY' ? <div className="r"><span>{t.cart.delivery}</span><Money rial={order.deliveryFee} locale={locale} /></div> : null}
          <div className="r total"><span>{t.cart.total}</span><Money rial={order.total} locale={locale} /></div>
        </div>
        <p className="tiny muted">{t.order.payment}: {PAYMENT_METHOD_LABELS[order.paymentMethod][locale]} · {PAYMENT_STATUS_LABELS[order.paymentStatus][locale]}</p>
        <p className="tiny muted">{L({ nameFa: `شعبه‌ی ${order.branch.nameFa}`, nameEn: `${order.branch.nameEn} branch` })} · {locale === 'fa' ? order.branch.addressFa : order.branch.addressEn}</p>
        {order.addressText ? <p className="tiny muted">{order.addressText}</p> : null}
        <Link className="btn ghost block" href={href(locale, '/shop')}>{t.cart.toMenu}</Link>
      </aside>
    </div>
  );
}
