'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ORDER_TYPE_LABELS, type OrderStatus } from '@tada/shared';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { Art, useToast } from '@/components/ui';
import { errFa, type AdminBranch, type StaffUser } from '@/components/admin/kit';
import { printReceipt } from '@/components/admin/receipt';

const COLS: { title: string; statuses: OrderStatus[]; art: string }[] = [
  { title: 'جدید', statuses: ['PLACED'], art: 'notes' },
  { title: 'در حال آماده‌سازی', statuses: ['PREPARING'], art: 'espresso' },
  { title: 'آماده و در راه', statuses: ['READY', 'OUT_FOR_DELIVERY'], art: 'hand' },
];

function next(o: Order): { to: OrderStatus; label: string } | null {
  switch (o.status) {
    case 'PLACED': return { to: 'PREPARING', label: 'شروع' };
    case 'PREPARING': return { to: 'READY', label: 'آماده شد' };
    case 'READY': return o.type === 'DELIVERY' ? { to: 'OUT_FOR_DELIVERY', label: 'تحویل پیک' } : { to: 'COMPLETED', label: 'تحویل شد' };
    case 'OUT_FOR_DELIVERY': return { to: 'COMPLETED', label: 'رسید' };
    default: return null;
  }
}

function ding(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    o.type = 'sine';
    g.gain.setValueAtTime(0.0001, now + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.18);
    o.stop(now + i * 0.18 + 0.55);
  });
}

export default function BarScreen() {
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState<StaffUser | null>(null);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [live, setLive] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const audio = useRef<AudioContext | null>(null);
  const [sound, setSound] = useState(false);
  const known = useRef<Set<string>>(new Set());

  useEffect(() => {
    api<{ staff: StaffUser | null }>('/api/staff/me').then(async (r) => {
      if (!r.staff) { router.replace('/admin/login?next=/bar'); return; }
      setMe(r.staff);
      const b = await api<{ branches: AdminBranch[] }>('/api/staff/branches');
      setBranches(b.branches);
      let saved = '';
      try { saved = localStorage.getItem('tada.bar.branch') ?? ''; } catch { /* ignore */ }
      setBranchId(r.staff.branchId ?? (b.branches.some((x) => x.id === saved) ? saved : b.branches[0]?.id ?? ''));
    }).catch(() => router.replace('/admin/login?next=/bar'));
  }, [router]);

  const load = useCallback(async () => {
    if (!branchId) return;
    const r = await api<{ orders: Order[] }>(`/api/staff/orders?status=ACTIVE&branchId=${branchId}&pageSize=200`);
    const incoming = r.orders.filter((o) => o.status === 'PLACED' && !known.current.has(o.id));
    if (known.current.size && incoming.length) {
      setFresh((f) => new Set([...f, ...incoming.map((o) => o.id)]));
      if (audio.current) ding(audio.current);
    }
    r.orders.forEach((o) => known.current.add(o.id));
    setOrders(r.orders);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    try { localStorage.setItem('tada.bar.branch', branchId); } catch { /* ignore */ }
    known.current = new Set();
    void load();
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      es = new EventSource(`/api/staff/orders/stream?branchId=${branchId}`);
      es.addEventListener('ready', () => setLive(true));
      es.addEventListener('order', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(), 250);
      });
      es.onerror = () => setLive(false);
    };
    connect();
    // Safety net if the stream drops behind a proxy.
    const poll = setInterval(() => void load(), 30_000);
    return () => { es?.close(); clearInterval(poll); if (timer) clearTimeout(timer); };
  }, [branchId, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  const act = async (o: Order, path: string, body: unknown = {}) => {
    try {
      await api(`/api/staff/orders/${o.id}${path}`, { method: 'POST', json: body });
      setFresh((f) => { const n = new Set(f); n.delete(o.id); return n; });
      await load();
    } catch (e) {
      toast(errFa(e));
    }
  };

  if (!me) return <div className="kds" />;
  const branch = branches.find((b) => b.id === branchId);

  return (
    <div className="kds">
      <header className="kds-top">
        <img src="/brand/tada-wordmark-fa_white.svg" alt="تادا" />
        <b>صفحه‌ی بار</b>
        {me.role === 'OWNER' ? (
          <select className="select" style={{ width: 'auto', minHeight: 38, background: 'var(--plum)', color: 'var(--cream)', borderColor: 'transparent' }} value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="شعبه">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}
          </select>
        ) : <span>{branch?.nameFa}</span>}
        <span className={`live${live ? '' : ' off'}`}><i />{live ? 'زنده' : 'در حال اتصال…'}</span>
        <span className="spacer" />
        {!sound ? (
          <button type="button" className="btn sm" onClick={() => { audio.current = new AudioContext(); ding(audio.current); setSound(true); }}>فعال‌سازی صدای سفارش</button>
        ) : <span className="tiny" style={{ color: 'var(--haze)' }}>صدا روشن است</span>}
        <a className="btn ghost sm" style={{ color: 'var(--cream)', borderColor: 'rgba(195,173,207,.4)' }} href="/admin">پنل</a>
      </header>
      <main className="kds-cols">
        {COLS.map((c) => {
          const list = orders.filter((o) => c.statuses.includes(o.status));
          return (
            <section key={c.title} className="kds-col" aria-label={c.title}>
              <h2><Art name={c.art} style={{ width: 18, height: 22 }} />{c.title}<span className="c num">{list.length.toLocaleString('fa-IR')}</span></h2>
              {list.map((o) => {
                const mins = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
                const n = next(o);
                return (
                  <article key={o.id} className={`ticket${fresh.has(o.id) ? ' fresh' : ''}`} data-testid={`ticket-${o.number}`}>
                    <div className="t-head">
                      <b className="num">#{o.number.toLocaleString('fa-IR')}</b>
                      <span className="badge">{ORDER_TYPE_LABELS[o.type].fa}{o.table ? ` · میز ${o.table.number.toLocaleString('fa-IR')}` : ''}</span>
                      {o.paymentStatus !== 'PAID' ? <span className="badge warn">پرداخت نشده</span> : null}
                    </div>
                    <span className={`age${mins >= 15 && o.status !== 'READY' ? ' late' : ''}`}>{o.customerName} · {mins.toLocaleString('fa-IR')} دقیقه پیش</span>
                    <ul>
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <span className="q num">{i.quantity.toLocaleString('fa-IR')}×</span>
                          <span>{i.nameFa}{i.options.length ? <small>{i.options.map((x) => x.nameFa).join(' · ')}</small> : null}{i.note ? <small style={{ color: 'var(--tada)' }}>«{i.note}»</small> : null}</span>
                        </li>
                      ))}
                    </ul>
                    {o.note ? <p className="alert" style={{ padding: '6px 10px', fontSize: 13 }}>{o.note}</p> : null}
                    {o.type === 'DELIVERY' && o.addressText ? <small className="muted">{o.addressText}</small> : null}
                    <div className="acts">
                      {n ? <button type="button" className="btn sm" onClick={() => void act(o, '/status', { status: n.to })}>{n.label}</button> : null}
                      {o.paymentStatus === 'UNPAID' && o.paymentMethod !== 'ONLINE' ? <button type="button" className="btn sm soft" onClick={() => void act(o, '/mark-paid')}>پرداخت شد</button> : null}
                      <button type="button" className="btn sm ghost" onClick={() => printReceipt(o)}>چاپ</button>
                      <span className="spacer" />
                      <button type="button" className="btn sm ghost" aria-label="لغو سفارش" onClick={() => confirm(`سفارش #${o.number} لغو شود؟`) && void act(o, '/status', { status: 'CANCELLED' })}>✕</button>
                    </div>
                  </article>
                );
              })}
              {!list.length ? <p style={{ color: 'var(--haze)', textAlign: 'center', padding: 20 }}>خالی</p> : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}
