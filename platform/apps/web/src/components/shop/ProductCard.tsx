'use client';
import Link from 'next/link';
import type { Locale } from '@tada/shared';
import type { Product } from '@/lib/types';
import { dict, href } from '@/lib/i18n';
import { Art, Money } from '../ui';

export function ProductVisual({ p, className = '' }: { p: Pick<Product, 'art' | 'imageUrl' | 'nameFa'>; className?: string }) {
  return p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className={className} /> : <Art name={p.art} className={className} />;
}

/** Whether a product can go straight into the cart with its default choices. */
export const quickAddable = (p: Product) => p.optionGroups.every((g) => g.minSelect === 0 || g.options.filter((o) => o.isDefault).length >= g.minSelect);

export function ProductCard({ p, locale, onAdd, index = 0 }: { p: Product; locale: Locale; onAdd: (p: Product) => void; index?: number }) {
  const t = dict(locale);
  const name = locale === 'fa' ? p.nameFa : p.nameEn;
  return (
    <article className={`pcard k-${p.kind}${p.available ? '' : ' off'}`} style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <Link href={href(locale, `/shop/p/${p.slug}`)} style={{ textDecoration: 'none', color: 'inherit', display: 'contents' }}>
        <div className="media">
          <ProductVisual p={p} />
          {!p.available ? <span className="badge dark sold">{t.menu.soldOut}</span> : null}
          {p.isFeatured && p.available ? <span className="feat" title={t.menu.featured}><Art name="notes" style={{ width: 22, height: 10 }} /></span> : null}
        </div>
        <div className="body">
          <span className="name">{name}</span>
          <span className="desc">{locale === 'fa' ? p.descFa : p.descEn}</span>
        </div>
      </Link>
      <div className="body" style={{ paddingTop: 0 }}>
        <div className="foot">
          <span className="price"><Money rial={p.price} locale={locale} /></span>
          {p.available ? (
            <button type="button" className="add" onClick={() => onAdd(p)} aria-label={`${t.menu.add} ${name}`}>+</button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
