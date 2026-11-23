'use client';
import { useMemo, useState } from 'react';
import { formatToman, type Locale } from '@tada/shared';
import type { Product } from '@/lib/types';
import { cart } from '@/lib/cart';
import { dict } from '@/lib/i18n';
import { Stepper, useToast } from '../ui';

/** Option groups, quantity and note for one product, then "add to cart". Used by the sheet and the product page. */
export function ProductOptions({ p, locale, onAdded }: { p: Product; locale: Locale; onAdded?: () => void }) {
  const t = dict(locale);
  const toast = useToast();
  const [chosen, setChosen] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(p.optionGroups.map((g) => [g.id, g.minSelect > 0 ? g.options.filter((o) => o.isDefault).slice(0, g.maxSelect).map((o) => o.id) : []])),
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const L = (o: { nameFa: string; nameEn: string }) => (locale === 'fa' ? o.nameFa : o.nameEn);

  const unit = useMemo(() => {
    let price = p.price;
    for (const g of p.optionGroups) for (const o of g.options) if (chosen[g.id]?.includes(o.id)) price += o.priceDelta;
    return price;
  }, [chosen, p]);
  const missing = p.optionGroups.filter((g) => (chosen[g.id]?.length ?? 0) < g.minSelect);

  const toggle = (groupId: string, optionId: string, single: boolean) =>
    setChosen((c) => {
      const cur = c[groupId] ?? [];
      if (single) return { ...c, [groupId]: [optionId] };
      const g = p.optionGroups.find((x) => x.id === groupId)!;
      const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : cur.length < g.maxSelect ? [...cur, optionId] : cur;
      return { ...c, [groupId]: next };
    });

  const add = () => {
    const optionIds = Object.values(chosen).flat();
    const opts = p.optionGroups.flatMap((g) => g.options.filter((o) => optionIds.includes(o.id)));
    cart.add({
      productId: p.id, slug: p.slug, nameFa: p.nameFa, nameEn: p.nameEn, art: p.art, imageUrl: p.imageUrl,
      unitPrice: unit, quantity: qty, optionIds, optionsFa: opts.map((o) => o.nameFa), optionsEn: opts.map((o) => o.nameEn),
      ...(note.trim() ? { note: note.trim().slice(0, 140) } : {}),
    });
    toast(t.product.added);
    onAdded?.();
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      {p.optionGroups.map((g) => {
        const single = g.maxSelect === 1;
        return (
          <fieldset className="optgroup" key={g.id}>
            <legend>
              {L(g)}
              <span className={`badge ${g.minSelect > 0 ? '' : 'ok'}`}>{g.minSelect > 0 ? t.product.required : t.product.optional}</span>
              {!single ? <small className="muted">{t.product.pickUpTo(g.maxSelect)}</small> : null}
            </legend>
            {g.options.map((o) => (
              <label className="opt" key={o.id}>
                <input
                  type={single && g.minSelect > 0 ? 'radio' : 'checkbox'}
                  name={`g-${g.id}`}
                  checked={chosen[g.id]?.includes(o.id) ?? false}
                  onChange={() => (single && g.minSelect === 0 && chosen[g.id]?.includes(o.id) ? setChosen((c) => ({ ...c, [g.id]: [] })) : toggle(g.id, o.id, single))}
                />
                <span>{L(o)}</span>
                {o.priceDelta ? <span className="delta num">{o.priceDelta > 0 ? '+' : ''}{formatToman(o.priceDelta, locale)}</span> : null}
              </label>
            ))}
          </fieldset>
        );
      })}
      {p.kind !== 'PACKAGED' ? (
        <label className="field">
          <span>{t.product.note}</span>
          <input className="input" value={note} maxLength={140} placeholder={t.product.notePh} onChange={(e) => setNote(e.target.value)} />
        </label>
      ) : null}
      <div className="addbar">
        <Stepper value={qty} onChange={setQty} label={t.product.qty} />
        <button type="button" className="btn block" onClick={add} disabled={!p.available || missing.length > 0}>
          {t.product.addToCart} · <span className="num">{formatToman(unit * qty, locale)}</span>
        </button>
      </div>
    </div>
  );
}
