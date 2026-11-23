'use client';
import { useEffect, useState } from 'react';
import { formatToman, type Locale } from '@tada/shared';
import type { Product } from '@/lib/types';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { dict } from '@/lib/i18n';
import { ProductVisual } from './ProductCard';
import { ProductOptions } from './ProductOptions';

const SCALES = ['sweetness', 'bitterness', 'acidity', 'body', 'caffeine'] as const;

export function ProductDetail({ p: initial, locale, priceText }: { p: Product; locale: Locale; priceText: string }) {
  const t = dict(locale);
  const state = useCart();
  const [p, setP] = useState(initial);
  // Price and availability follow the branch the customer chose.
  useEffect(() => {
    if (!state.branchId) return;
    api<{ product: Product }>(`/api/products/${initial.slug}?branch=${state.branchId}`).then((r) => setP(r.product)).catch(() => undefined);
  }, [state.branchId, initial.slug]);
  const name = locale === 'fa' ? p.nameFa : p.nameEn;
  return (
    <div className="pdetail">
      <div className="visual"><ProductVisual p={p} /></div>
      <div className="stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6 }}>
          {p.category ? <span className="badge" style={{ width: 'fit-content' }}>{locale === 'fa' ? p.category.nameFa : p.category.nameEn}</span> : null}
          <h1>{name}</h1>
          <p className="muted">{locale === 'fa' ? p.descFa : p.descEn}</p>
          <span className="price num">{p.price === initial.price ? priceText : formatToman(p.price, locale)}</span>
          {!p.available ? <span className="badge dark" style={{ width: 'fit-content' }}>{t.menu.soldOut}</span> : null}
        </div>
        {p.taste ? (
          <div className="tastebars" aria-label={t.product.taste}>
            {SCALES.map((k) => (
              <div className="tastebar" key={k}>
                <span>{t.tasteScale[k]}</span>
                <span className="track" role="meter" aria-valuemin={0} aria-valuemax={5} aria-valuenow={p.taste![k]} aria-label={t.tasteScale[k]}>
                  {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= p.taste![k] ? 'on' : ''} />)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {p.allergens.length ? <p className="tiny muted">{t.product.allergens}: {p.allergens.join('، ')}</p> : null}
        <ProductOptions key={p.id + p.price} p={p} locale={locale} />
      </div>
    </div>
  );
}
