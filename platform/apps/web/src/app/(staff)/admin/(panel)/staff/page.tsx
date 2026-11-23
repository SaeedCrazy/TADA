'use client';
import { useState } from 'react';
import { STAFF_ROLE_LABELS, STAFF_ROLES } from '@tada/shared';
import { api } from '@/lib/api';
import { Drawer, ErrorLine, Switch, faDate, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Row { id: string; username: string; name: string; role: (typeof STAFF_ROLES)[number]; branchId: string | null; isActive: boolean; lastLoginAt: string | null }
type Form = Omit<Row, 'id' | 'lastLoginAt'> & { id?: string; password: string };

export default function StaffAdmin() {
  const { branches } = useStaff();
  const list = useLoad<{ staff: Row[] }>('/api/staff/staff-users');
  const [form, setForm] = useState<Form | null>(null);
  const { busy, error, run, setError } = useAction();
  const upd = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const save = async () => {
    if (!form) return;
    const { id, password, ...rest } = form;
    const body = { ...rest, branchId: rest.role === 'OWNER' ? null : rest.branchId, ...(password ? { password } : {}) };
    const ok = await run(() => (id ? api(`/api/staff/staff-users/${id}`, { method: 'PUT', json: body }) : api('/api/staff/staff-users', { method: 'POST', json: body })));
    if (ok !== undefined) { setForm(null); void list.reload(); }
  };
  return (
    <>
      <div className="adm-top"><h1>همکاران</h1><span className="spacer" /><button type="button" className="btn" onClick={() => { setError(null); setForm({ username: '', name: '', role: 'BARISTA', branchId: branches[0]?.id ?? null, isActive: true, password: '' }); }}>همکار جدید</button></div>
      <ErrorLine error={list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>شعبه</th><th>آخرین ورود</th><th>وضعیت</th></tr></thead>
          <tbody>
            {list.data?.staff.map((s) => (
              <tr key={s.id} className="click" onClick={() => { setError(null); setForm({ ...s, password: '' }); }}>
                <td>{s.name}</td><td dir="ltr" style={{ textAlign: 'end' }}>{s.username}</td><td>{STAFF_ROLE_LABELS[s.role].fa}</td>
                <td>{branches.find((b) => b.id === s.branchId)?.nameFa ?? 'همه'}</td>
                <td className="tiny">{s.lastLoginAt ? faDate(s.lastLoginAt) : '—'}</td>
                <td>{s.isActive ? <span className="badge ok">فعال</span> : <span className="badge dark">غیرفعال</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? form.name : 'همکار جدید'}>
        {form ? (
          <div className="stack">
            <ErrorLine error={error} />
            <div className="form-grid">
              <label className="field"><span>نام</span><input className="input" value={form.name} onChange={(e) => upd({ name: e.target.value })} /></label>
              <label className="field"><span>نام کاربری</span><input className="input ltr" dir="ltr" value={form.username} onChange={(e) => upd({ username: e.target.value.toLowerCase() })} /></label>
              <label className="field"><span>نقش</span><select className="select" value={form.role} onChange={(e) => upd({ role: e.target.value as Form['role'] })}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABELS[r].fa}</option>)}</select></label>
              {form.role !== 'OWNER' ? <label className="field"><span>شعبه</span><select className="select" value={form.branchId ?? ''} onChange={(e) => upd({ branchId: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.nameFa}</option>)}</select></label> : null}
              <label className="field full"><span>{form.id ? 'رمز جدید (خالی = بدون تغییر)' : 'رمز عبور (حداقل ۱۰ نویسه)'}</span><input className="input ltr" dir="ltr" type="password" autoComplete="new-password" value={form.password} onChange={(e) => upd({ password: e.target.value })} /></label>
            </div>
            <p className="muted tiny">مدیر شعبه: سفارش‌ها، موجودی، میزها، گزارش و مشتری‌های شعبه‌ی خودش. بار: صفحه‌ی بار، سفارش‌ها و «تمام شد». تغییر دسترسی، ورودهای باز آن همکار را می‌بندد.</p>
            <Switch checked={form.isActive} onChange={(v) => upd({ isActive: v })} label="فعال" />
            <button type="button" className="btn" onClick={() => void save()} disabled={busy || !form.name || form.username.length < 3 || (!form.id && form.password.length < 10)}>ذخیره</button>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
