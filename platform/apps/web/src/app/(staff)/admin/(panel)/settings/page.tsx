'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { ErrorLine, useAction, useLoad, useStaff } from '@/components/admin/kit';

const NAMES: Record<string, Record<string, string>> = {
  payments: { zarinpal: 'زرین‌پال', mock: 'درگاه آزمایشی (فقط توسعه)' },
  sms: { kavenegar: 'کاوه‌نگار', console: 'نمایش در لاگ (فقط توسعه)' },
  accounting: { webhook: 'وب‌هوک امضاشده', none: 'خاموش (CSV)' },
  assistant: { llm: 'مدل زبانی', guided: 'هدایت‌شده' },
};

export default function SettingsAdmin() {
  const { me } = useStaff();
  const toast = useToast();
  const s = useLoad<{ settings: Record<string, unknown>; integrations: Record<string, string> }>(me.role === 'OWNER' ? '/api/staff/settings' : null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const { busy, error, run } = useAction();
  return (
    <>
      <div className="adm-top"><h1>تنظیمات</h1></div>
      <ErrorLine error={error ?? s.error} />
      {s.data ? (
        <div className="panel">
          <h2>اتصال‌ها</h2>
          <div className="kpis" style={{ marginBottom: 0 }}>
            {Object.entries(s.data.integrations).map(([k, v]) => (
              <div className="kpi" key={k}>
                <span className="k">{({ payments: 'درگاه پرداخت', sms: 'پیامک', accounting: 'حسابداری', assistant: 'دستیار' } as Record<string, string>)[k] ?? k}</span>
                <span className="v" style={{ fontSize: 17 }}>{NAMES[k]?.[v] ?? v}</span>
              </div>
            ))}
          </div>
          <p className="muted tiny" style={{ marginTop: 10 }}>این‌ها با متغیرهای محیطی سرور تنظیم می‌شوند (راهنما: docs/DEPLOY.md). کلیدها هرگز در پنل نمایش داده نمی‌شوند.</p>
        </div>
      ) : null}
      <div className="panel" style={{ maxWidth: 460 }}>
        <h2>تغییر رمز من</h2>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api('/api/staff/me/password', { method: 'POST', json: { password: pw } }); setPw(''); setPw2(''); toast('رمز عوض شد'); }); }}>
          <label className="field"><span>رمز جدید (حداقل ۱۰ نویسه)</span><input className="input ltr" dir="ltr" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="field"><span>تکرار رمز</span><input className="input ltr" dir="ltr" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={Boolean(pw2) && pw !== pw2} /></label>
          <button className="btn" disabled={busy || pw.length < 10 || pw !== pw2}>ذخیره</button>
        </form>
      </div>
    </>
  );
}
