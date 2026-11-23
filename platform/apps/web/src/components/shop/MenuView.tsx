'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatToman, type Locale } from '@tada/shared';
import type { Branch, Menu, Product } from '@/lib/types';
import { api } from '@/lib/api';
import { cart, useCart } from '@/lib/cart';
import { dict, href } from '@/lib/i18n';
import { Art, Sheet, useToast } from '../ui';
import { ProductCard, quickAddable } from './ProductCard';
import { ProductOptions } from './ProductOptions';
import { BranchPicker, branchStatusText } from './BranchPicker';

export function MenuView({ locale, initial, branches }: { locale: Locale; initial: Menu; branches: Branch[] }) {
  const t = dict(locale);
  const state = useCart();
  const toast = useToast();
  const [menu, setMenu] = useState<Menu>(initial);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState(false);
  const [sheet, setSheet] = useState<Product | null>(null);
  const branch = branches.find((b) => b.id === state.branchId) ?? null;

  useEffect(() => {
    if (!state.branchId) return;
    let alive = true;
    api<Menu>(`/api/menu?branch=${state.branchId}`).then((m) => alive && setMenu(m)).catch(() => undefined);
    return () => { alive = false; };
  }, [state.branchId]);

  const L = (x: { nameFa: string; nameEn: string }) => (locale === 'fa' ? x.nameFa : x.nameEn);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return menu.products.filter((p) => (cat === 'all' || p.categoryId === cat) && (!term || `${p.nameFa} ${p.nameEn} ${p.descFa} ${p.descEn}`.toLowerCase().includes(term)));
  }, [menu.products, cat, q]);
  const featured = menu.products.filter((p) => p.isFeatured && p.available);

  const onAdd = (p: Product) => {
    if (p.optionGroups.length === 0 && quickAddable(p)) {
      cart.add({ productId: p.id, slug: p.slug, nameFa: p.nameFa, nameEn: p.nameEn, art: p.art, imageUrl: p.imageUrl, unitPrice: p.price, quantity: 1, optionIds: [], optionsFa: [], optionsEn: [] });
      toast(t.product.added);
    } else setSheet(p);
  };

  const count = cart.count(state);

  return (
    <>
      <section className="hero">
        <div className="glow" aria-hidden />
        <div className="wrap inner">
          <div className="stack" style={{ gap: 10 }}>
            <h1>{t.hero.title}</h1>
            <p>{t.hero.lead}</p>
            <Link className="ask" href={href(locale, '/shop/assistant')}>
              <Art name="hand" />
              {t.hero.askAssistant}
            </Link>
          </div>
          <div className="door" aria-hidden><Art name="hand" /></div>
        </div>
      </section>

      <div className="wrap context-bar">
        {state.table ? (
          <span className="table-pill">
            <Art name="glass" style={{ width: 16, height: 20 }} />
            {t.table.at(state.table.number, locale === 'fa' ? state.table.branchFa : state.table.branchEn)}
          </span>
        ) : (
          <button type="button" className="branch-pill" onClick={() => setPicking(true)} aria-haspopup="dialog">
            <span className={`dot${branch?.open.open && branch.acceptsOrders ? ' open' : ''}`} aria-hidden />
            {branch ? L(branch) : t.branch.pick}
            {branch ? <small className="muted">{branchStatusText(branch, locale)}</small> : null}
          </button>
        )}
        {state.table ? <button type="button" className="btn ghost sm" onClick={() => cart.setTable(null)}>{t.table.leave}</button> : null}
        <span className="spacer" />
        <label className="sr-only" htmlFor="menu-search">{t.menu.search}</label>
        <input id="menu-search" className="input" style={{ maxWidth: 260, minHeight: 40 }} type="search" placeholder={t.menu.search} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <nav className="cats" aria-label={t.nav.menu}>
        <div className="wrap scroll">
          <button type="button" className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>{t.menu.all}</button>
          {menu.categories.map((c) => (
            <button type="button" key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              <Art name={c.art} />
              {L(c)}
            </button>
          ))}
        </div>
      </nav>

      <main className="wrap" id="main">
        {cat === 'all' && !q && featured.length ? (
          <section className="menu-section" aria-labelledby="sec-featured">
            <h2 id="sec-featured"><Art name="notes" />{t.menu.featured}</h2>
            <div className="grid">{featured.map((p, i) => <ProductCard key={`f-${p.id}`} p={p} locale={locale} onAdd={onAdd} index={i} />)}</div>
          </section>
        ) : null}
        {menu.categories
          .filter((c) => cat === 'all' || c.id === cat)
          .map((c) => {
            const items = filtered.filter((p) => p.categoryId === c.id);
            if (!items.length) return null;
            return (
              <section key={c.id} className="menu-section" id={`c-${c.slug}`} aria-labelledby={`h-${c.id}`}>
                <h2 id={`h-${c.id}`}><Art name={c.art} />{L(c)}</h2>
                <div className="grid">{items.map((p, i) => <ProductCard key={p.id} p={p} locale={locale} onAdd={onAdd} index={i} />)}</div>
              </section>
            );
          })}
        {!filtered.length ? <div className="empty-state"><Art name="cup" /><p>{t.menu.empty}</p></div> : null}
      </main>

      {count > 0 ? (
        <Link className="cartbar" href={href(locale, '/shop/cart')}>
          <span className="n num" suppressHydrationWarning>{count}</span>
          <span suppressHydrationWarning>{formatToman(cart.estimate(state), locale)}</span>
          <span className="btn sm">{t.cart.view}</span>
        </Link>
      ) : null}

      <BranchPicker open={picking} onClose={() => setPicking(false)} branches={branches} locale={locale} selected={state.branchId} onPick={(id) => { cart.setBranch(id); setPicking(false); }} />

      <Sheet open={Boolean(sheet)} onClose={() => setSheet(null)} label={sheet ? L(sheet) : ''}>
        {sheet ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="row" style={{ alignItems: 'start' }}>
              <div className="stack" style={{ gap: 4 }}>
                <h2 style={{ fontSize: 22 }}>{L(sheet)}</h2>
                <p className="muted">{locale === 'fa' ? sheet.descFa : sheet.descEn}</p>
              </div>
            </div>
            <ProductOptions p={sheet} locale={locale} onAdded={() => setSheet(null)} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
