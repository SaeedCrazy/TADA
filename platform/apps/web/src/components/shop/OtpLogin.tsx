'use client';
import { useEffect, useState } from 'react';
import { localizeDigits, normalizeIranMobile, toLatinDigits, type Locale } from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { dict, errorText } from '@/lib/i18n';
import { Spinner } from '../ui';

/** Two steps: phone, then the 5-digit code. Calls onDone with the signed-in customer. */
export function OtpLogin({ locale, onDone, askName = true }: { locale: Locale; onDone: (c: Customer) => void; askName?: boolean }) {
  const t = dict(locale);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const normalized = normalizeIranMobile(phone);

  const send = async () => {
    if (!normalized) { setErr(t.errors.invalid_mobile!); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ resendIn: number }>('/api/auth/otp/request', { method: 'POST', json: { phone: normalized } });
      setStep('code');
      setWait(r.resendIn);
    } catch (e) {
      setErr(errorText(locale, isApiError(e) ? e.code : undefined));
      if (isApiError(e) && e.code === 'otp_wait') {
        setStep('code');
        setWait(Number((e.details as { retryAfter?: number })?.retryAfter ?? 60));
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ customer: Customer }>('/api/auth/otp/verify', {
        method: 'POST',
        json: { phone: normalized, code: toLatinDigits(code), ...(name.trim() ? { name: name.trim() } : {}) },
      });
      onDone(r.customer);
    } catch (e) {
      setErr(errorText(locale, isApiError(e) ? e.code : undefined));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void (step === 'phone' ? send() : verify()); }} noValidate>
      {step === 'phone' ? (
        <>
          <label className="field">
            <span>{t.login.phone}</span>
            <input
              className="input ltr num" inputMode="tel" autoComplete="tel" dir="ltr" placeholder={t.login.phonePh}
              value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(err)} required name="phone"
            />
          </label>
          {askName ? (
            <label className="field">
              <span>{t.login.name}</span>
              <input className="input" autoComplete="name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} name="name" />
            </label>
          ) : null}
          {err ? <p className="alert bad" role="alert">{err}</p> : null}
          <button className="btn block" disabled={busy || !phone}>{busy ? <Spinner /> : null}{t.login.send}</button>
        </>
      ) : (
        <>
          <p className="muted">{t.login.codeSent(localizeDigits(normalized ?? phone, locale))}</p>
          <label className="field">
            <span>{t.login.code}</span>
            <input
              className="input ltr num" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={5} autoFocus
              value={code} onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, ''))} aria-invalid={Boolean(err)} name="code"
              style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
            />
          </label>
          {err ? <p className="alert bad" role="alert">{err}</p> : null}
          <button className="btn block" disabled={busy || code.length !== 5}>{busy ? <Spinner /> : null}{t.login.verify}</button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn ghost sm" onClick={() => { setStep('phone'); setCode(''); setErr(null); }}>{t.login.change}</button>
            <button type="button" className="btn ghost sm" disabled={wait > 0 || busy} onClick={() => void send()}>
              {wait > 0 ? t.login.resendIn(wait) : t.login.resend}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
