'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ORDER_STATUS_LABELS, localizeDigits, type Locale } from '@tada/shared';
import { api } from '@/lib/api';
import type { Address, Customer, Order, Product } from '@/lib/types';
import { dict, href } from '@/lib/i18n';
import { Art, Money, useToast } from '../ui';
import { OtpLogin } from './OtpLogin';

export function Account({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const toast = useToast();
  const [me, setMe] = useState<(Customer & { tasteConsent?: boolean }) | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const r = await api<{ customer: (Customer & { tasteConsent?: boolean }) | null }>('/api/auth/me');
    setMe(r.customer);
    if (!r.customer) return;
    setName(r.customer.name ?? '');
    const [o, a, f] = await Promise.all([
      api<{ orders: Order[] }>('/api/me/orders?pageSize=20'),
      api<{ addresses: Address[] }>('/api/me/addresses'),
      api<{ favorites: Product[] }>('/api/assistant/for-me').catch(() => ({ favorites: [] as Product[] })),
    ]);
    setOrders(o.orders);
    setAddresses(a.addresses);
    setFavorites(f.favorites);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (me === undefined) return <div className="skeleton" style={{ height: 240 }} />;
  if (!me) {
    return (
      <div className="section" style={{ maxWidth: 440 }}>
        <h2>{t.login.title}</h2>
        <OtpLogin locale={locale} onDone={() => void load()} />
      </div>
    );
  }

  const saveProfile = async (patch: Record<string, unknown>) => {
    const r = await api<{ customer: Customer & { tasteConsent?: boolean } }>('/api/me', { method: 'PATCH', json: patch });
    setMe((m) => ({ ...(m as Customer), ...r.customer }));
    toast(t.account.saved);
  };

  return (
    <div className="cols">
      <div className="stack" style={{ gap: 16 }}>
        <h2 style={{ fontSize: 24 }}>{t.account.hello(me.name || localizeDigits(me.phone, locale))}</h2>
        {favorites.length ? (
          <section className="section">
            <h2>{t.account.favorites}</h2>
            <div className="picks">
              {favorites.map((p) => (
                <Link key={p.id} href={href(locale, `/shop/p/${p.slug}`)} className="pick" style={{ textDecoration: 'none' }}>
                  <span className="thumb"><Art name={p.art} /></span>
                  <span><b style={{ color: 'var(--plum)' }}>{locale === 'fa' ? p.nameFa : p.nameEn}</b><br /><small className="muted"><Money rial={p.price} locale={locale} /></small></span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        <section className="section">
          <h2>{t.account.orders}</h2>
          {orders.length ? orders.map((o) => (
            <Link key={o.id} href={`${href(locale, `/shop/orders/${o.id}`)}?t=${o.accessToken}`} className="row" style={{ justifyContent: 'space-between', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span><b>#{localizeDigits(o.number, locale)}</b> · <small className="muted">{new Date(o.createdAt).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB')}</small></span>
              <span className="badge">{ORDER_STATUS_LABELS[o.status][locale]}</span>
              <Money rial={o.total} locale={locale} />
            </Link>
          )) : <p className="muted">{t.account.noOrders}</p>}
        </section>
      </div>
      <aside className="stack">
        <section className="section">
          <h2>{t.account.profile}</h2>
          <p className="num muted" dir="ltr">{me.phone}</p>
          <label className="field"><span>{t.account.name}</span><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
          <button type="button" className="btn soft" onClick={() => void saveProfile({ name: name.trim() })} disabled={!name.trim()}>{t.account.save}</button>
        </section>
        <section className="section">
          <h2>{t.account.taste}</h2>
          <label className="check"><input type="checkbox" checked={Boolean(me.tasteConsent)} onChange={(e) => void saveProfile({ tasteConsent: e.target.checked })} />{t.account.tasteConsent}</label>
          <button type="button" className="btn ghost sm" onClick={async () => { await api('/api/me/taste', { method: 'DELETE' }); toast(t.account.saved); }}>{t.account.tasteForget}</button>
        </section>
        <section className="section">
          <h2>{t.account.addresses}</h2>
          {addresses.length ? addresses.map((a) => (
            <div key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span><b>{a.title}</b><br /><small className="muted">{a.line}</small></span>
              <button type="button" className="btn ghost sm" onClick={async () => { await api(`/api/me/addresses/${a.id}`, { method: 'DELETE' }); setAddresses((x) => x.filter((y) => y.id !== a.id)); }}>{t.account.delete}</button>
            </div>
          )) : <p className="muted">{t.account.noAddresses}</p>}
        </section>
        <button type="button" className="btn ghost" onClick={async () => { await api('/api/auth/logout', { method: 'POST', json: {} }); setMe(null); }}>{t.login.logout}</button>
      </aside>
    </div>
  );
}
