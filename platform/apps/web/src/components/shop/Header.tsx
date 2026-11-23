'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@tada/shared';
import { cart, useCart } from '@/lib/cart';
import { dict, href } from '@/lib/i18n';

export function ShopHeader({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const state = useCart();
  const n = cart.count(state);
  const path = usePathname();
  const other = locale === 'fa' ? `/en${path}` : path.replace(/^\/en/, '') || '/shop';
  const link = (p: string, label: string) => {
    const to = href(locale, p);
    const current = path === to || (p !== '/shop' && path.startsWith(to));
    return <Link href={to} aria-current={current ? 'page' : undefined}>{label}</Link>;
  };
  return (
    <header className="shop-header">
      <div className="wrap bar">
        <Link className="logo" href={href(locale, '/shop')} aria-label={t.brand}>
          <img src={locale === 'fa' ? '/brand/tada-wordmark-fa_white.svg' : '/brand/tada-wordmark-stacked_white.svg'} alt={t.brand} />
        </Link>
        <nav aria-label={t.nav.menu}>
          {link('/shop', t.nav.menu)}
          {link('/shop/assistant', t.nav.assistant)}
          {link('/shop/account', t.nav.account)}
        </nav>
        <span className="spacer" />
        <a className="tool" href={other} hrefLang={locale === 'fa' ? 'en' : 'fa'} lang={locale === 'fa' ? 'en' : 'fa'}>{t.langSwitch}</a>
        <Link className="tool" href={href(locale, '/shop/account')} aria-label={t.nav.account}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
        </Link>
        <Link className="tool" href={href(locale, '/shop/cart')} aria-label={`${t.nav.cart} (${n})`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
          {n > 0 ? <span className="count num" suppressHydrationWarning>{n}</span> : null}
        </Link>
      </div>
    </header>
  );
}
