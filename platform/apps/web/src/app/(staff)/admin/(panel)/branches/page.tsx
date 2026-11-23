'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Branch } from '@/lib/types';
import { useToast } from '@/components/ui';
import { Drawer, ErrorLine, Switch, TomanInput, toman, useAction, useLoad, useStaff } from '@/components/admin/kit';

const MapPicker = dynamic(() => import('@/components/shop/MapPicker').then((m) => m.MapPicker), { ssr: false });

type Row = Branch & { isActive: boolean; deliveryEnabledRaw: boolean };
interface Form {
  id?: string; slug: string; nameFa: string; nameEn: string; addressFa: string; addressEn: string; phone: string;
  lat: number | null; lng: number | null; hours: [string, string][]; isActive: boolean; acceptsOrders: boolean;
  deliveryEnabled: boolean; deliveryBaseFee: number; deliveryPerKm: number; deliveryMaxKm: number; deliveryMinOrder: number; deliveryFreeAbove: number;
}

const blank: Form = {
  slug: '', nameFa: '', nameEn: '', addressFa: '', addressEn: '', phone: '', lat: null, lng: null, hours: [['09:00', '16:00'], ['17:00', '23:00']],
  isActive: true, acceptsOrders: true, deliveryEnabled: false, deliveryBaseFee: 300000, deliveryPerKm: 100000, deliveryMaxKm: 5, deliveryMinOrder: 0, deliveryFreeAbove: 0,
};

export default function BranchesAdmin() {
  const toast = useToast();
  const { reloadBranches } = useStaff();
  const list = useLoad<{ branches: Row[] }>('/api/staff/branches');
  const [form, setForm] = useState<Form | null>(null);
  const [pinning, setPinning] = useState(false);
  const { busy, error, run, setError } = useAction();
  const upd = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    if (!form) return;
    const { id, slug, ...rest } = form;
    const body = { ...rest, phone: rest.phone || null, ...(slug && !id ? { slug } : {}) };
    const ok = await run(() => (id ? api(`/api/staff/branches/${id}`, { method: 'PUT', json: body }) : api('/api/staff/branches', { method: 'POST', json: body })));
    if (ok !== undefined) { toast('ذخیره شد'); setForm(null); void list.reload(); void reloadBranches(); }
  };

  return (
    <>
      <div className="adm-top"><h1>شعبه‌ها</h1><span className="spacer" /><button type="button" className="btn" onClick={() => { setError(null); setForm({ ...blank }); }}>شعبه‌ی جدید</button></div>
      <ErrorLine error={list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>شعبه</th><th>آدرس</th><th>ساعت</th><th>دلیوری</th><th>وضعیت</th></tr></thead>
          <tbody>
            {list.data?.branches.map((b) => (
              <tr key={b.id} className="click" onClick={() => { setError(null); setForm({ id: b.id, slug: b.slug, nameFa: b.nameFa, nameEn: b.nameEn, addressFa: b.addressFa, addressEn: b.addressEn, phone: b.phone ?? '', lat: b.lat, lng: b.lng, hours: b.hours, isActive: b.isActive, acceptsOrders: b.acceptsOrders, deliveryEnabled: b.deliveryEnabledRaw, deliveryBaseFee: b.delivery.baseFee, deliveryPerKm: b.delivery.perKm, deliveryMaxKm: b.delivery.maxKm, deliveryMinOrder: b.delivery.minOrder, deliveryFreeAbove: b.delivery.freeAbove }); }}>
                <td><b>{b.nameFa}</b><br /><small className="muted">{b.nameEn}</small></td>
                <td className="tiny">{b.addressFa}</td>
                <td className="num tiny">{b.hours.map((h) => h.join('–')).join(' ، ')}</td>
                <td>{b.delivery.enabled ? <span className="badge ok">تا {b.delivery.maxKm.toLocaleString('fa-IR')} کیلومتر</span> : b.deliveryEnabledRaw ? <span className="badge warn">محل روی نقشه ثبت نشده</span> : <span className="badge">خاموش</span>}</td>
                <td>{!b.isActive ? <span className="badge dark">غیرفعال</span> : b.acceptsOrders ? <span className="badge ok">سفارش می‌گیرد</span> : <span className="badge warn">متوقف</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? `شعبه‌ی ${form.nameFa}` : 'شعبه‌ی جدید'}>
        {form ? (
          <div className="stack" style={{ gap: 16 }}>
            <ErrorLine error={error} />
            <div className="form-grid">
              <label className="field"><span>نام فارسی</span><input className="input" value={form.nameFa} onChange={(e) => upd({ nameFa: e.target.value })} /></label>
              <label className="field"><span>نام انگلیسی</span><input className="input ltr" dir="ltr" value={form.nameEn} onChange={(e) => upd({ nameEn: e.target.value })} /></label>
              <label className="field full"><span>آدرس فارسی</span><input className="input" value={form.addressFa} onChange={(e) => upd({ addressFa: e.target.value })} /></label>
              <label className="field full"><span>آدرس انگلیسی</span><input className="input ltr" dir="ltr" value={form.addressEn} onChange={(e) => upd({ addressEn: e.target.value })} /></label>
              <label className="field"><span>تلفن</span><input className="input ltr num" dir="ltr" value={form.phone} onChange={(e) => upd({ phone: e.target.value })} /></label>
            </div>
            <div className="panel" style={{ margin: 0 }}>
              <h2>ساعت کاری (به وقت تهران)</h2>
              {form.hours.map((h, i) => (
                <div className="row" key={i} style={{ marginBottom: 6 }}>
                  <input className="input num ltr" dir="ltr" type="time" value={h[0]} aria-label="از" onChange={(e) => upd({ hours: form.hours.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })} />
                  <span>تا</span>
                  <input className="input num ltr" dir="ltr" type="time" value={h[1] === '24:00' ? '23:59' : h[1]} aria-label="تا" onChange={(e) => upd({ hours: form.hours.map((x, j) => (j === i ? [x[0], e.target.value] : x)) })} />
                  <button type="button" className="btn ghost sm" onClick={() => upd({ hours: form.hours.filter((_, j) => j !== i) })} disabled={form.hours.length <= 1}>✕</button>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={() => upd({ hours: [...form.hours, ['17:00', '23:00']] })}>بازه‌ی جدید</button>
            </div>
            <div className="panel" style={{ margin: 0 }}>
              <h2>محل شعبه و دلیوری</h2>
              <p className="muted tiny">{form.lat !== null ? `محل ثبت شده: ${form.lat.toFixed(5)}, ${form.lng!.toFixed(5)}` : 'محل شعبه هنوز ثبت نشده؛ دلیوری بدون آن فعال نمی‌شود.'}</p>
              <button type="button" className="btn ghost sm" style={{ width: 'fit-content' }} onClick={() => setPinning((v) => !v)}>{pinning ? 'بستن نقشه' : 'تعیین روی نقشه'}</button>
              {pinning ? <div style={{ marginTop: 8 }}><MapPicker value={form.lat !== null ? { lat: form.lat, lng: form.lng! } : null} onChange={(v) => upd({ lat: v.lat, lng: v.lng })} label="محل شعبه" /></div> : null}
              <div style={{ marginTop: 12 }}><Switch checked={form.deliveryEnabled} onChange={(v) => upd({ deliveryEnabled: v })} label="دلیوری فعال باشد" /></div>
              {form.deliveryEnabled ? (
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <TomanInput label="هزینه‌ی پایه (کیلومتر اول)" value={form.deliveryBaseFee} onChange={(v) => upd({ deliveryBaseFee: v ?? 0 })} />
                  <TomanInput label="هر کیلومتر بعدی" value={form.deliveryPerKm} onChange={(v) => upd({ deliveryPerKm: v ?? 0 })} />
                  <label className="field"><span>حداکثر فاصله (کیلومتر)</span><input className="input num" type="number" step="0.5" min={0.5} max={30} value={form.deliveryMaxKm} onChange={(e) => upd({ deliveryMaxKm: Number(e.target.value) })} /></label>
                  <TomanInput label="حداقل سفارش" value={form.deliveryMinOrder} onChange={(v) => upd({ deliveryMinOrder: v ?? 0 })} />
                  <TomanInput label="ارسال رایگان از (۰ یعنی هرگز)" value={form.deliveryFreeAbove} onChange={(v) => upd({ deliveryFreeAbove: v ?? 0 })} />
                </div>
              ) : null}
              {form.deliveryEnabled ? <p className="muted tiny">نمونه: ۳٫۲ کیلومتر = {toman(form.deliveryBaseFee + form.deliveryPerKm * 3)}</p> : null}
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 20 }}>
              <Switch checked={form.isActive} onChange={(v) => upd({ isActive: v })} label="شعبه فعال است" />
              <Switch checked={form.acceptsOrders} onChange={(v) => upd({ acceptsOrders: v })} label="سفارش آنلاین می‌گیرد" />
            </div>
            <button type="button" className="btn" onClick={() => void save()} disabled={busy || !form.nameFa || !form.nameEn || form.addressFa.length < 3 || form.addressEn.length < 3}>ذخیره</button>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
