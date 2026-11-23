'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PAYMENT_METHODS_BY_TYPE, LOGIN_REQUIRED_TYPES, PAYMENT_METHOD_LABELS, localizeDigits,
  type Locale, type OrderType, type PaymentMethod,
} from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import { cart, useCart } from '@/lib/cart';
import type { Address, Branch, Customer, Order, Quote } from '@/lib/types';
import { dict, errorText, href } from '@/lib/i18n';
import { Art, Money, Spinner } from '../ui';
import { OtpLogin } from './OtpLogin';
import { branchStatusText } from './BranchPicker';

const MapPicker = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), { ssr: false, loading: () => <div className="map skeleton" /> });

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);

export function Checkout({ locale, branches }: { locale: Locale; branches: Branch[] }) {
  const t = dict(locale);
  const router = useRouter();
  const state = useCart();
  const [type, setType] = useState<OrderType>(state.table ? 'DINE_IN' : 'PICKUP');
  const [branchId, setBranchId] = useState<string | null>(state.branchId);
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | 'new'>('new');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addressText, setAddressText] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressTitle, setAddressTitle] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState(state.discountCode);
  const [method, setMethod] = useState<PaymentMethod>('ONLINE');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const idem = useRef(uuid());

  useEffect(() => { if (state.table) setType('DINE_IN'); }, [state.table]);
  useEffect(() => { if (!branchId && state.branchId) setBranchId(state.branchId); }, [state.branchId, branchId]);

  const loadMe = useCallback(async () => {
    try {
      const r = await api<{ customer: Customer | null }>('/api/auth/me');
      setCustomer(r.customer);
      if (r.customer?.name) setName((n) => n || r.customer!.name!);
      if (r.customer) {
        const a = await api<{ addresses: Address[] }>('/api/me/addresses');
        setAddresses(a.addresses);
        if (a.addresses[0]) setAddressId(a.addresses[0].id);
      }
    } catch {
      setCustomer(null);
    }
  }, []);
  useEffect(() => { void loadMe(); }, [loadMe]);

  const methods = PAYMENT_METHODS_BY_TYPE[type];
  useEffect(() => { if (!methods.includes(method)) setMethod(methods[0]!); }, [methods, method]);

  const chosenAddress = addresses.find((a) => a.id === addressId) ?? null;
  const deliveryLoc = type === 'DELIVERY' ? (chosenAddress ? { lat: chosenAddress.lat, lng: chosenAddress.lng } : location) : null;

  const body = useMemo(() => ({
    type,
    items: cart.items(state),
    ...(type === 'DINE_IN' && state.table ? { tableToken: state.table.token } : {}),
    ...(type === 'PICKUP' && branchId ? { branchId } : {}),
    ...(type === 'DELIVERY' && deliveryLoc ? { location: deliveryLoc } : {}),
    ...(state.discountCode ? { discountCode: state.discountCode } : {}),
  }), [type, state, branchId, deliveryLoc]);

  const canQuote = body.items.length > 0 && (type === 'DINE_IN' ? Boolean(state.table) : type === 'PICKUP' ? Boolean(branchId) : Boolean(deliveryLoc));

  useEffect(() => {
    if (!canQuote) { setQuote(null); setQuoteErr(null); return; }
    const id = setTimeout(async () => {
      try {
        const r = await api<{ quote: Quote }>('/api/cart/quote', { method: 'POST', json: body });
        setQuote(r.quote);
        setQuoteErr(null);
      } catch (e) {
        setQuote(null);
        setQuoteErr(errorText(locale, isApiError(e) ? e.code : undefined));
      }
    }, 300);
    return () => clearTimeout(id);
  }, [body, canQuote, locale]);

  const needsLogin = LOGIN_REQUIRED_TYPES.includes(type) && !customer;
  const ready = Boolean(quote) && !needsLogin && name.trim().length > 0 && (type !== 'DELIVERY' || chosenAddress || addressText.trim().length >= 5);

  const place = async () => {
    setPlacing(true);
    setPlaceErr(null);
    try {
      let useAddressId = chosenAddress?.id;
      if (type === 'DELIVERY' && !chosenAddress && saveAddress && customer && location) {
        const a = await api<{ address: Address }>('/api/me/addresses', {
          method: 'POST', json: { title: addressTitle.trim() || t.checkout.newAddress, line: addressText.trim(), lat: location.lat, lng: location.lng },
        });
        useAddressId = a.address.id;
      }
      const r = await api<{ order: Order; payment: { redirectUrl: string } | null }>('/api/orders', {
        method: 'POST',
        json: {
          ...body,
          paymentMethod: method,
          customerName: name.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(type === 'DELIVERY' ? (useAddressId ? { addressId: useAddressId } : { addressText: addressText.trim() }) : {}),
          idempotencyKey: idem.current,
          locale,
        },
      });
      const track = `${href(locale, `/shop/orders/${r.order.id}`)}?t=${r.order.accessToken}`;
      try { localStorage.setItem('tada.lastOrder', JSON.stringify({ id: r.order.id, t: r.order.accessToken })); } catch { /* ignore */ }
      cart.clear();
      if (r.payment?.redirectUrl) {
        window.location.assign(r.payment.redirectUrl);
        return;
      }
      router.push(track);
    } catch (e) {
      setPlaceErr(errorText(locale, isApiError(e) ? e.code : undefined));
      // A failure before the order existed may be retried with the same key safely.
      setPlacing(false);
    }
  };

  if (!state.lines.length && !placing) {
    return (
      <div className="empty-state">
        <Art name="glass" />
        <p>{t.cart.empty}</p>
        <Link className="btn" href={href(locale, '/shop')}>{t.cart.toMenu}</Link>
      </div>
    );
  }

  const step = !canQuote ? 0 : needsLogin || !ready ? 1 : 2;
  const L = (x: { nameFa: string; nameEn: string }) => (locale === 'fa' ? x.nameFa : x.nameEn);

  return (
    <div className="cols">
      <div className="stack" style={{ gap: 16 }}>
        <ol className="steps" aria-label={t.checkout.title}>
          {t.checkout.steps.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>)}
        </ol>

        <section className="section" aria-labelledby="how">
          <h2 id="how">{t.checkout.how}</h2>
          <div className="segmented">
            {(['DINE_IN', 'PICKUP', 'DELIVERY'] as const).map((k) => (
              <button
                key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
                disabled={(k === 'DINE_IN' && !state.table) || (k === 'DELIVERY' && !branches.some((b) => b.delivery.enabled))}
              >
                <Art name={k === 'DINE_IN' ? 'glass' : k === 'PICKUP' ? 'coffeeCup' : 'scooter'} />
                {t.checkout[k]}
              </button>
            ))}
          </div>
          {!state.table ? <p className="muted tiny">{t.checkout.dineInHint}</p> : null}
          {type === 'DINE_IN' && state.table ? (
            <p className="badge" style={{ width: 'fit-content' }}>{t.table.at(state.table.number, locale === 'fa' ? state.table.branchFa : state.table.branchEn)}</p>
          ) : null}
          {type === 'PICKUP' ? (
            <div className="stack" role="radiogroup" aria-label={t.checkout.branch}>
              {branches.map((b) => (
                <label key={b.id} className="addr">
                  <input type="radio" name="branch" checked={branchId === b.id} onChange={() => { setBranchId(b.id); cart.setBranch(b.id); }} />
                  <span className="stack" style={{ gap: 0 }}>
                    <b>{L(b)}</b>
                    <small className="muted">{branchStatusText(b, locale)}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </section>

        {LOGIN_REQUIRED_TYPES.includes(type) && customer === null ? (
          <section className="section">
            <h2>{t.login.title}</h2>
            <p className="muted tiny">{t.checkout.loginNeeded}</p>
            <OtpLogin locale={locale} onDone={() => void loadMe()} />
          </section>
        ) : null}

        {type === 'DELIVERY' && customer ? (
          <section className="section" aria-labelledby="addr">
            <h2 id="addr">{t.checkout.address}</h2>
            {addresses.length ? (
              <div className="stack" role="radiogroup" aria-label={t.checkout.savedAddresses}>
                {addresses.map((a) => (
                  <label key={a.id} className="addr">
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="stack" style={{ gap: 0 }}><b>{a.title}</b><small className="muted">{a.line}</small></span>
                  </label>
                ))}
                <label className="addr">
                  <input type="radio" name="address" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
                  <b>{t.checkout.newAddress}</b>
                </label>
              </div>
            ) : null}
            {addressId === 'new' ? (
              <>
                <p className="muted tiny">{t.checkout.pin}</p>
                <MapPicker value={location} onChange={setLocation} center={branches.find((b) => b.lat !== null) ? { lat: branches.find((b) => b.lat !== null)!.lat!, lng: branches.find((b) => b.lat !== null)!.lng! } : null} label={t.checkout.pin} />
                <button type="button" className="btn ghost sm" style={{ width: 'fit-content' }} onClick={() => navigator.geolocation?.getCurrentPosition((p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }))}>
                  {t.checkout.useMyLocation}
                </button>
                <label className="field">
                  <span>{t.checkout.addressLine}</span>
                  <textarea className="textarea" value={addressText} maxLength={300} placeholder={t.checkout.addressPh} onChange={(e) => setAddressText(e.target.value)} autoComplete="street-address" />
                </label>
                <label className="check"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />{t.checkout.saveAddress}</label>
                {saveAddress ? (
                  <label className="field">
                    <span>{t.checkout.addressTitle}</span>
                    <input className="input" value={addressTitle} maxLength={40} placeholder={t.checkout.addressTitlePh} onChange={(e) => setAddressTitle(e.target.value)} />
                  </label>
                ) : null}
              </>
            ) : null}
            {quote?.delivery ? <p className="badge" style={{ width: 'fit-content' }}>{L(quote.branch)} · {t.checkout.distance(localizeDigits(quote.delivery.distanceKm.toFixed(1), locale))}</p> : null}
          </section>
        ) : null}

        {!needsLogin ? (
          <section className="section" aria-labelledby="details">
            <h2 id="details">{t.checkout.steps[1]}</h2>
            <label className="field">
              <span>{t.checkout.name}</span>
              <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-invalid={!name.trim() && Boolean(quote)} />
            </label>
            <label className="field">
              <span>{t.checkout.note}</span>
              <input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="field">
              <span>{t.checkout.code}</span>
              <div className="row">
                <input className="input ltr" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={32} aria-label={t.checkout.code} />
                <button type="button" className="btn soft" onClick={() => cart.setDiscount(code)}>{t.checkout.apply}</button>
              </div>
              {quote?.discountError ? <span className="err">{errorText(locale, quote.discountError)}</span> : null}
            </div>
            <fieldset className="optgroup">
              <legend>{t.checkout.pay}</legend>
              {methods.map((m) => (
                <label className="opt" key={m}>
                  <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                  <span>{PAYMENT_METHOD_LABELS[m][locale]}</span>
                </label>
              ))}
            </fieldset>
          </section>
        ) : null}
      </div>

      <aside className="section" aria-labelledby="sum">
        <h2 id="sum">{t.checkout.summary}</h2>
        {state.lines.map((l) => (
          <div className="r row tiny" key={l.key} style={{ justifyContent: 'space-between' }}>
            <span>{localizeDigits(l.quantity, locale)} × {locale === 'fa' ? l.nameFa : l.nameEn}</span>
            <Money rial={l.unitPrice * l.quantity} locale={locale} />
          </div>
        ))}
        {quoteErr ? <p className="alert bad" role="alert">{quoteErr}</p> : null}
        {quote ? (
          <div className="summary">
            <div className="r"><span>{t.cart.subtotal}</span><Money rial={quote.subtotal} locale={locale} /></div>
            {quote.discount ? <div className="r disc"><span>{t.cart.discount} ({quote.discount.code})</span><span>− <Money rial={quote.discount.amount} locale={locale} /></span></div> : null}
            {quote.delivery ? <div className="r"><span>{t.cart.delivery}</span>{quote.delivery.fee ? <Money rial={quote.delivery.fee} locale={locale} /> : <span>{t.checkout.free}</span>}</div> : null}
            <div className="r total"><span>{t.cart.total}</span><Money rial={quote.total} locale={locale} /></div>
          </div>
        ) : null}
        {placeErr ? <p className="alert bad" role="alert">{placeErr}</p> : null}
        <button type="button" className="btn block" disabled={!ready || placing} onClick={() => void place()} data-testid="place-order">
          {placing ? <Spinner /> : null}
          {placing && method === 'ONLINE' ? t.checkout.redirecting : method === 'ONLINE' ? t.checkout.placeAndPay : t.checkout.place}
        </button>
      </aside>
    </div>
  );
}
