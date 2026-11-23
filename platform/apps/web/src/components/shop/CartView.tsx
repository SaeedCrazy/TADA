'use client';
import Link from 'next/link';
import type { Locale } from '@tada/shared';
import { cart, useCart } from '@/lib/cart';
import { dict, href } from '@/lib/i18n';
import { Art, Money, Stepper } from '../ui';

export function CartView({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const state = useCart();
  if (!state.lines.length) {
    return (
      <div className="empty-state">
        <Art name="glass" />
        <p>{t.cart.empty}</p>
        <Link className="btn" href={href(locale, '/shop')}>{t.cart.toMenu}</Link>
      </div>
    );
  }
  return (
    <div className="cols">
      <section aria-label={t.cart.title}>
        {state.lines.map((l) => (
          <div className="line" key={l.key}>
            <div className="thumb">{l.imageUrl ? <img src={l.imageUrl} alt="" /> : <Art name={l.art} />}</div>
            <div className="meta">
              <b>{locale === 'fa' ? l.nameFa : l.nameEn}</b>
              {(locale === 'fa' ? l.optionsFa : l.optionsEn).length ? <small>{(locale === 'fa' ? l.optionsFa : l.optionsEn).join(' · ')}</small> : null}
              {l.note ? <small>«{l.note}»</small> : null}
              <span className="num"><Money rial={l.unitPrice * l.quantity} locale={locale} /></span>
            </div>
            <div className="end">
              <Stepper value={l.quantity} min={0} onChange={(n) => cart.setQty(l.key, n)} label={t.product.qty} />
              <button type="button" className="btn ghost sm" onClick={() => cart.remove(l.key)}>{t.cart.remove}</button>
            </div>
          </div>
        ))}
      </section>
      <aside className="section">
        <div className="summary">
          <div className="r"><span>{t.cart.subtotal} ({t.cart.items(cart.count(state))})</span><Money rial={cart.estimate(state)} locale={locale} /></div>
        </div>
        <Link className="btn block" href={href(locale, '/shop/checkout')}>{t.cart.checkout}</Link>
        <Link className="btn ghost block" href={href(locale, '/shop')}>{t.product.back}</Link>
      </aside>
    </div>
  );
}
