'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Locale, QuizQuestion } from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import { cart, useCart } from '@/lib/cart';
import type { AssistantReply, Pick, Product } from '@/lib/types';
import { dict, errorText, href } from '@/lib/i18n';
import { Art, Money, Spinner, useToast } from '../ui';

interface Msg { role: 'me' | 'bot'; text: string; reply?: AssistantReply }

function PickCard({ p, reasons, locale, onAdd }: { p: Product; reasons?: string[]; locale: Locale; onAdd: (p: Product) => void }) {
  const t = dict(locale);
  return (
    <div className="pick">
      <span className="thumb"><Art name={p.art} /></span>
      <div className="stack" style={{ gap: 4 }}>
        <Link href={href(locale, `/shop/p/${p.slug}`)} style={{ fontWeight: 800, color: 'var(--plum)', textDecoration: 'none' }}>{locale === 'fa' ? p.nameFa : p.nameEn}</Link>
        {reasons?.length ? <span className="why">{reasons.join(' · ')}</span> : null}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <small><Money rial={p.price} locale={locale} /></small>
          <button type="button" className="btn sm soft" onClick={() => onAdd(p)}>{t.menu.add}</button>
        </div>
      </div>
    </div>
  );
}

export function Assistant({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const toast = useToast();
  const state = useCart();
  const [tab, setTab] = useState<'quiz' | 'chat'>('quiz');
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ picks: Pick[]; pairing: Product | null } | null>(null);
  const [save, setSave] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const conv = useRef<{ id: string; key?: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ quiz: QuizQuestion[] }>('/api/assistant/quiz').then((r) => setQuiz(r.quiz)).catch((e) => setErr(isApiError(e) && e.code === 'assistant_disabled' ? t.assistant.unavailable : t.errors.generic!));
    try {
      const saved = sessionStorage.getItem('tada.conv');
      if (saved) conv.current = JSON.parse(saved);
    } catch { /* ignore */ }
  }, [t]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  const addProduct = (p: Product, quantity = 1, optionIds?: string[]) => {
    const defaults = optionIds ?? p.optionGroups.flatMap((g) => (g.minSelect > 0 ? g.options.filter((o) => o.isDefault).slice(0, g.minSelect).map((o) => o.id) : []));
    const opts = p.optionGroups.flatMap((g) => g.options.filter((o) => defaults.includes(o.id)));
    cart.add({
      productId: p.id, slug: p.slug, nameFa: p.nameFa, nameEn: p.nameEn, art: p.art, imageUrl: p.imageUrl,
      unitPrice: p.price + opts.reduce((s, o) => s + o.priceDelta, 0), quantity, optionIds: defaults,
      optionsFa: opts.map((o) => o.nameFa), optionsEn: opts.map((o) => o.nameEn),
    });
    toast(t.product.added);
  };

  const finishQuiz = async (final: Record<string, string | string[]>) => {
    setBusy(true);
    try {
      const r = await api<{ picks: Pick[]; pairing: Product | null }>('/api/assistant/recommend', {
        method: 'POST', json: { answers: final, save, ...(state.branchId ? { branchId: state.branchId } : {}) }, headers: { 'accept-language': locale },
      });
      setResult(r);
    } catch (e) {
      setErr(errorText(locale, isApiError(e) ? e.code : undefined));
    } finally {
      setBusy(false);
    }
  };

  const send = async (message: string) => {
    if (!message.trim()) return;
    setMsgs((m) => [...m, { role: 'me', text: message }]);
    setText('');
    setBusy(true);
    try {
      const r = await api<{ conversationId: string; clientKey?: string; reply: AssistantReply }>('/api/assistant/chat', {
        method: 'POST',
        json: { message, locale, ...(conv.current ? { conversationId: conv.current.id } : {}), ...(state.branchId ? { branchId: state.branchId } : {}) },
        headers: conv.current?.key ? { 'x-conversation-key': conv.current.key } : {},
      });
      conv.current = { id: r.conversationId, key: r.clientKey ?? conv.current?.key };
      try { sessionStorage.setItem('tada.conv', JSON.stringify(conv.current)); } catch { /* ignore */ }
      setMsgs((m) => [...m, { role: 'bot', text: r.reply.text, reply: r.reply }]);
    } catch (e) {
      if (isApiError(e) && e.status === 404) conv.current = null;
      setMsgs((m) => [...m, { role: 'bot', text: errorText(locale, isApiError(e) ? e.code : undefined) }]);
    } finally {
      setBusy(false);
    }
  };

  const q = quiz?.[step];
  const L = (x: { fa: string; en: string }) => x[locale];

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
      <div className="row" style={{ gap: 14 }}>
        <span style={{ width: 54, height: 70, borderRadius: '27px 27px 8px 8px', background: 'var(--night)', color: 'var(--cream)', display: 'grid', placeItems: 'center' }}>
          <Art name="hand" style={{ width: 26, height: 40 }} />
        </span>
        <div><h1 style={{ fontSize: 28 }}>{t.assistant.title}</h1><p className="muted">{t.assistant.lead}</p></div>
      </div>
      <div className="row" role="tablist" aria-label={t.assistant.title}>
        <button type="button" role="tab" className="chip" aria-selected={tab === 'quiz'} onClick={() => setTab('quiz')}>{t.assistant.quiz}</button>
        <button type="button" role="tab" className="chip" aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>{t.assistant.chat}</button>
      </div>
      {err ? <p className="alert bad">{err}</p> : null}

      {tab === 'quiz' ? (
        <section className="section" role="tabpanel">
          {result ? (
            <div className="stack">
              <h2>{t.assistant.picks}</h2>
              <div className="picks">{result.picks.map((p) => <PickCard key={p.product.id} p={p.product} reasons={p.reasons} locale={locale} onAdd={(x) => addProduct(x)} />)}</div>
              {result.pairing ? (<><h2 style={{ fontSize: 16 }}>{t.assistant.pairing}</h2><div className="picks"><PickCard p={result.pairing} locale={locale} onAdd={(x) => addProduct(x)} /></div></>) : null}
              <button type="button" className="btn ghost" style={{ width: 'fit-content' }} onClick={() => { setResult(null); setAnswers({}); setStep(0); }}>{t.assistant.restart}</button>
            </div>
          ) : q ? (
            <div className="quiz-q">
              <small className="muted num">{step + 1} / {quiz!.length}</small>
              <h2>{L(q)}</h2>
              {q.multi ? <small className="muted">{t.assistant.multi}</small> : null}
              <div className="quiz-opts">
                {q.options.map((o) => {
                  const cur = answers[q.id];
                  const on = Array.isArray(cur) ? cur.includes(o.id) : cur === o.id;
                  return (
                    <button
                      type="button" key={o.id} className="chip" aria-pressed={on}
                      onClick={() => {
                        if (q.multi) {
                          const arr = Array.isArray(cur) ? cur : [];
                          setAnswers({ ...answers, [q.id]: on ? arr.filter((x) => x !== o.id) : [...arr, o.id] });
                        } else {
                          const next = { ...answers, [q.id]: o.id };
                          setAnswers(next);
                          if (step < quiz!.length - 1) setStep(step + 1);
                        }
                      }}
                    >{L(o)}</button>
                  );
                })}
              </div>
              <div className="row">
                {step > 0 ? <button type="button" className="btn ghost sm" onClick={() => setStep(step - 1)}>{t.common.back}</button> : null}
                <span className="spacer" />
                {step < quiz!.length - 1 ? <button type="button" className="btn ghost sm" onClick={() => setStep(step + 1)}>{t.assistant.next}</button> : (
                  <button type="button" className="btn" onClick={() => void finishQuiz(answers)} disabled={busy}>{busy ? <Spinner /> : null}{t.assistant.see}</button>
                )}
              </div>
              <label className="check tiny"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />{t.assistant.saveTaste}</label>
            </div>
          ) : <div className="skeleton" style={{ height: 160 }} />}
        </section>
      ) : (
        <section role="tabpanel" className="stack">
          <div className="chat" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className="stack" style={{ gap: 8 }}>
                <div className={`bubble ${m.role}`}>{m.text}</div>
                {m.reply?.picks.length ? <div className="picks">{m.reply.picks.map((p) => <PickCard key={p.product.id} p={p.product} reasons={p.reasons} locale={locale} onAdd={(x) => addProduct(x)} />)}</div> : null}
                {m.reply?.pairing ? <div className="picks"><PickCard p={m.reply.pairing} locale={locale} onAdd={(x) => addProduct(x)} /></div> : null}
                {m.reply?.proposedCart.length ? (
                  <button type="button" className="btn" style={{ width: 'fit-content' }} onClick={async () => {
                    const menu = await api<{ products: Product[] }>(`/api/menu${state.branchId ? `?branch=${state.branchId}` : ''}`);
                    for (const line of m.reply!.proposedCart) {
                      const p = menu.products.find((x) => x.id === line.productId);
                      if (p) addProduct(p, line.quantity, line.optionIds);
                    }
                  }}>{t.assistant.addAll}</button>
                ) : null}
              </div>
            ))}
            {busy ? <div className="bubble bot muted">{t.assistant.thinking}</div> : null}
            <div ref={end} />
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {(msgs.at(-1)?.reply?.quickReplies.length ? msgs.at(-1)!.reply!.quickReplies : (locale === 'fa' ? ['یک چیز شیرین و خنک', 'تلخ و قوی', 'بی‌کافئین'] : ['Something sweet and iced', 'Bold and strong', 'No caffeine'])).map((s) => (
              <button type="button" key={s} className="chip" onClick={() => void send(s)} disabled={busy}>{s}</button>
            ))}
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <label className="sr-only" htmlFor="ask">{t.assistant.ph}</label>
            <input id="ask" className="input" value={text} maxLength={600} placeholder={t.assistant.ph} onChange={(e) => setText(e.target.value)} autoComplete="off" />
            <button className="btn" disabled={busy || !text.trim()}>{t.assistant.send}</button>
          </form>
          <p className="muted tiny">{t.assistant.privacy}</p>
        </section>
      )}
    </div>
  );
}
