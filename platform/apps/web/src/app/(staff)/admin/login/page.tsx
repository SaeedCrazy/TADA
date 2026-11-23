'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { errFa } from '@/components/admin/kit';
import { Spinner } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next = sp.get('next');
  const safeNext = next && /^\/(admin|bar)(\/|$)/.test(next) ? next : '/admin';
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--night)', padding: 16 }}>
      <form
        className="stack"
        style={{ width: 'min(380px, 100%)', background: 'var(--paper)', borderRadius: '190px 190px 20px 20px', padding: '80px 26px 26px' }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const r = await api<{ staff: { role: string } }>('/api/staff/login', { method: 'POST', json: { username: username.trim(), password } });
            router.replace(r.staff.role === 'BARISTA' && safeNext === '/admin' ? '/bar' : safeNext);
          } catch (e2) {
            setErr(errFa(e2) === 'مشکلی پیش آمد. دوباره امتحان کنید.' ? 'نام کاربری یا رمز درست نیست.' : errFa(e2));
            setBusy(false);
          }
        }}
      >
        <img src="/brand/tada-wordmark-stacked_purple.svg" alt="تادا" style={{ height: 64, margin: '0 auto 6px' }} />
        <h1 style={{ fontSize: 20, textAlign: 'center' }}>ورود همکاران تادا</h1>
        <label className="field"><span>نام کاربری</span><input className="input ltr" dir="ltr" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required name="username" /></label>
        <label className="field"><span>رمز عبور</span><input className="input ltr" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required name="password" /></label>
        {err ? <p className="alert bad" role="alert">{err}</p> : null}
        <button className="btn block" disabled={busy}>{busy ? <Spinner /> : null}ورود</button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
