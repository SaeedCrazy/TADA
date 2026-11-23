'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Drawer, ErrorLine, Switch, TomanInput, faDate, toman, useAction, useLoad, useStaff } from '@/components/admin/kit';

interface Code { id: string; code: string; type: 'PERCENT' | 'FIXED'; value: number; maxDiscount: number | null; minSubtotal: number; startsAt: string | null; endsAt: string | null; usageLimit: number | null; perCustomerLimit: number | null; usedCount: number; isActive: boolean }
type Form = Omit<Code, 'id' | 'usedCount'> & { id?: string };

const blank: Form = { code: '', type: 'PERCENT', value: 10, maxDiscount: null, minSubtotal: 0, startsAt: null, endsAt: null, usageLimit: null, perCustomerLimit: 1, isActive: true };
const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export default function DiscountsAdmin() {
  const { me } = useStaff();
  const list = useLoad<{ discounts: Code[] }>('/api/staff/discounts');
  const [form, setForm] = useState<Form | null>(null);
  const { busy, error, run, setError } = useAction();
  const upd = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const canEdit = me.role === 'OWNER';
  const save = async () => {
    if (!form) return;
    const { id, ...body } = form;
    const ok = await run(() => (id ? api(`/api/staff/discounts/${id}`, { method: 'PUT', json: body }) : api('/api/staff/discounts', { method: 'POST', json: body })));
    if (ok !== undefined) { setForm(null); void list.reload(); }
  };
  return (
    <>
      <div className="adm-top"><h1>کدهای تخفیف</h1><span className="spacer" />{canEdit ? <button type="button" className="btn" onClick={() => { setError(null); setForm({ ...blank }); }}>کد جدید</button> : null}</div>
      <ErrorLine error={list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>کد</th><th>مقدار</th><th>شرط</th><th>مصرف</th><th>اعتبار</th><th>وضعیت</th></tr></thead>
          <tbody>
            {list.data?.discounts.map((d) => (
              <tr key={d.id} className={canEdit ? 'click' : ''} onClick={() => canEdit && setForm({ ...d })}>
                <td><b dir="ltr">{d.code}</b></td>
                <td>{d.type === 'PERCENT' ? `٪${d.value.toLocaleString('fa-IR')}${d.maxDiscount ? ` تا ${toman(d.maxDiscount)}` : ''}` : toman(d.value)}</td>
                <td className="tiny">{d.minSubtotal ? `حداقل ${toman(d.minSubtotal)}` : '—'}{d.perCustomerLimit ? ` · هر نفر ${d.perCustomerLimit.toLocaleString('fa-IR')} بار` : ''}</td>
                <td className="num">{d.usedCount.toLocaleString('fa-IR')}{d.usageLimit ? ` / ${d.usageLimit.toLocaleString('fa-IR')}` : ''}</td>
                <td className="tiny">{d.startsAt ? faDate(d.startsAt, false) : '—'} تا {d.endsAt ? faDate(d.endsAt, false) : '—'}</td>
                <td>{d.isActive ? <span className="badge ok">فعال</span> : <span className="badge dark">غیرفعال</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? `کد ${form.code}` : 'کد تخفیف جدید'}>
        {form ? (
          <div className="stack">
            <ErrorLine error={error} />
            <div className="form-grid">
              <label className="field"><span>کد (حروف انگلیسی و عدد)</span><input className="input ltr" dir="ltr" value={form.code} onChange={(e) => upd({ code: e.target.value.toUpperCase() })} /></label>
              <label className="field"><span>نوع</span><select className="select" value={form.type} onChange={(e) => upd({ type: e.target.value as Form['type'] })}><option value="PERCENT">درصدی</option><option value="FIXED">مبلغ ثابت</option></select></label>
              {form.type === 'PERCENT' ? (
                <>
                  <label className="field"><span>درصد</span><input className="input num" type="number" min={1} max={100} value={form.value} onChange={(e) => upd({ value: Number(e.target.value) })} /></label>
                  <TomanInput label="سقف تخفیف" allowNull value={form.maxDiscount} onChange={(v) => upd({ maxDiscount: v })} />
                </>
              ) : <TomanInput label="مبلغ تخفیف" value={form.value} onChange={(v) => upd({ value: v ?? 0 })} />}
              <TomanInput label="حداقل مبلغ سفارش" value={form.minSubtotal} onChange={(v) => upd({ minSubtotal: v ?? 0 })} />
              <label className="field"><span>کل دفعات مجاز</span><input className="input num" type="number" min={1} placeholder="نامحدود" value={form.usageLimit ?? ''} onChange={(e) => upd({ usageLimit: e.target.value ? Number(e.target.value) : null })} /></label>
              <label className="field"><span>دفعات برای هر مشتری</span><input className="input num" type="number" min={1} placeholder="نامحدود" value={form.perCustomerLimit ?? ''} onChange={(e) => upd({ perCustomerLimit: e.target.value ? Number(e.target.value) : null })} /></label>
              <label className="field"><span>شروع</span><input className="input ltr" dir="ltr" type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => upd({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
              <label className="field"><span>پایان</span><input className="input ltr" dir="ltr" type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => upd({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
            </div>
            <p className="muted tiny">کدهای با محدودیت «هر مشتری» فقط برای مشتری واردشده کار می‌کنند.</p>
            <Switch checked={form.isActive} onChange={(v) => upd({ isActive: v })} label="فعال" />
            <div className="row">
              <button type="button" className="btn" onClick={() => void save()} disabled={busy || form.code.length < 3}>ذخیره</button>
              {form.id ? <button type="button" className="btn ghost" onClick={() => confirm('حذف شود؟ اگر استفاده شده باشد، غیرفعال می‌شود.') && void run(async () => { await api(`/api/staff/discounts/${form.id}`, { method: 'DELETE' }); setForm(null); await list.reload(); })}>حذف</button> : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
