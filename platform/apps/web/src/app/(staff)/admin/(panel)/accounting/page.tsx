'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { ErrorLine, Pager, faDate, toman, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Job { id: string; status: 'PENDING' | 'DONE' | 'FAILED'; attempts: number; lastError: string | null; externalId: string | null; createdAt: string; nextAttemptAt: string; order: { number: number; total: number } }

export default function AccountingAdmin() {
  const { branches } = useStaff();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad<{ driver: string; jobs: Job[]; total: number; page: number; pageSize: number; counts: { status: string; _count: number }[] }>(`/api/staff/accounting/jobs?page=${page}${status ? `&status=${status}` : ''}`);
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: today.slice(0, 8) + '01', to: today, branchId: '' });
  const { error, run } = useAction();
  const count = (s: string) => list.data?.counts.find((c) => c.status === s)?._count ?? 0;
  const exportUrl = `/api/staff/accounting/export.csv?from=${range.from}&to=${new Date(new Date(range.to).getTime() + 86400000).toISOString().slice(0, 10)}${range.branchId ? `&branchId=${range.branchId}` : ''}`;
  return (
    <>
      <div className="adm-top"><h1>اتصال به حسابداری</h1></div>
      <div className="kpis">
        <div className="kpi"><span className="k">روش اتصال</span><span className="v" style={{ fontSize: 18 }}>{list.data?.driver === 'webhook' ? 'وب‌هوک امضاشده' : list.data?.driver === 'none' ? 'خاموش (فقط خروجی CSV)' : list.data?.driver ?? '…'}</span></div>
        <div className="kpi"><span className="k">ارسال‌شده</span><span className="v num">{count('DONE').toLocaleString('fa-IR')}</span></div>
        <div className="kpi"><span className="k">در صف</span><span className="v num">{count('PENDING').toLocaleString('fa-IR')}</span></div>
        <div className="kpi"><span className="k">ناموفق</span><span className="v num" style={{ color: count('FAILED') ? 'var(--bad)' : undefined }}>{count('FAILED').toLocaleString('fa-IR')}</span></div>
      </div>
      <div className="panel">
        <h2>خروجی فاکتورها (CSV برای نرم‌افزار حسابداری)</h2>
        <div className="filters" style={{ marginBottom: 0 }}>
          <label className="field"><span>از</span><input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label className="field"><span>تا</span><input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
          <label className="field"><span>شعبه</span><select className="select" value={range.branchId} onChange={(e) => setRange({ ...range, branchId: e.target.value })}><option value="">همه</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}</select></label>
          <a className="btn" href={exportUrl} download>دریافت CSV</a>
        </div>
        <p className="muted tiny" style={{ marginTop: 8 }}>هر سطر یک قلم فاکتور است؛ مبالغ به ریال. فایل در اکسل و بیشتر نرم‌افزارهای حسابداری قابل ورود است.</p>
      </div>
      <div className="filters">
        <label className="field"><span>وضعیت</span><select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">همه</option><option value="PENDING">در صف</option><option value="DONE">ارسال‌شده</option><option value="FAILED">ناموفق</option></select></label>
      </div>
      <ErrorLine error={error ?? list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>فاکتور</th><th className="end">مبلغ</th><th>وضعیت</th><th>تلاش</th><th>شناسه در حسابداری</th><th>خطا</th><th></th></tr></thead>
          <tbody>
            {list.data?.jobs.map((j) => (
              <tr key={j.id}>
                <td dir="ltr" style={{ textAlign: 'end' }}>TADA-{j.order.number}</td>
                <td className="end num">{toman(j.order.total)}</td>
                <td>{j.status === 'DONE' ? <span className="badge ok">ارسال شد</span> : j.status === 'FAILED' ? <span className="badge bad">ناموفق</span> : <span className="badge warn">در صف · {faDate(j.nextAttemptAt)}</span>}</td>
                <td className="num">{j.attempts.toLocaleString('fa-IR')}</td>
                <td dir="ltr">{j.externalId ?? '—'}</td>
                <td className="tiny" style={{ maxWidth: 260, wordBreak: 'break-word' }}>{j.lastError ?? ''}</td>
                <td>{j.status !== 'DONE' ? <button type="button" className="btn ghost sm" onClick={() => void run(async () => { await api(`/api/staff/accounting/jobs/${j.id}/retry`, { method: 'POST', json: {} }); await list.reload(); })}>ارسال دوباره</button> : null}</td>
              </tr>
            ))}
            {list.data && !list.data.jobs.length ? <tr><td colSpan={7} className="muted">موردی نیست.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
    </>
  );
}
