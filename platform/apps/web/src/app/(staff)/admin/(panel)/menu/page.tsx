'use client';
import { useState } from 'react';
import { TASTE_NOTES, NOTE_LABELS } from '@tada/shared';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';
import { Art, useToast } from '@/components/ui';
import { Drawer, ErrorLine, Switch, TomanInput, toman, useAction, useLoad } from '@/components/admin/kit';

interface Cat { id: string; slug: string; nameFa: string; nameEn: string; art: string | null; sort: number; isActive: boolean; _count?: { products: number } }
type AdminProduct = Product & { isActive: boolean; basePrice: number; sort?: number };
interface Opt { id?: string; nameFa: string; nameEn: string; priceDelta: number; isDefault: boolean; isActive: boolean; sort: number }
interface Group { id?: string; nameFa: string; nameEn: string; minSelect: number; maxSelect: number; sort: number; options: Opt[] }
interface Form {
  id?: string; slug: string; categoryId: string; kind: 'DRINK' | 'FOOD' | 'PACKAGED'; nameFa: string; nameEn: string; descFa: string; descEn: string;
  art: string; basePrice: number; isActive: boolean; isFeatured: boolean; sort: number; allergens: string;
  tasted: boolean; taste: { sweetness: number; bitterness: number; acidity: number; body: number; caffeine: number; milk: boolean; temperature: 'HOT' | 'ICED' | 'BOTH'; notes: string[] };
  optionGroups: Group[]; imageUrl: string | null;
}

const ARTS = ['glass', 'glass2', 'icedCup', 'coffeeCup', 'cup', 'leaf', 'teapot', 'kettle', 'lemon', 'croissant', 'cookie', 'cookies', 'biscuit', 'beans', 'pear', 'pitaya', 'citrus'];
const SCALE_LABELS = { sweetness: 'شیرینی', bitterness: 'تلخی', acidity: 'ترشی', body: 'غلظت', caffeine: 'کافئین' } as const;

const blank = (categoryId: string): Form => ({
  slug: '', categoryId, kind: 'DRINK', nameFa: '', nameEn: '', descFa: '', descEn: '', art: 'glass', basePrice: 0, isActive: true, isFeatured: false, sort: 0, allergens: '',
  tasted: true, taste: { sweetness: 2, bitterness: 2, acidity: 1, body: 2, caffeine: 2, milk: false, temperature: 'BOTH', notes: [] }, optionGroups: [], imageUrl: null,
});

function toForm(p: AdminProduct): Form {
  return {
    id: p.id, slug: p.slug, categoryId: p.categoryId, kind: p.kind, nameFa: p.nameFa, nameEn: p.nameEn, descFa: p.descFa, descEn: p.descEn,
    art: p.art ?? 'glass', basePrice: p.basePrice, isActive: p.isActive, isFeatured: p.isFeatured, sort: p.sort ?? 0, allergens: p.allergens.join('، '),
    tasted: Boolean(p.taste), taste: p.taste ? { ...p.taste, temperature: p.taste.temperature } : blank('').taste,
    optionGroups: p.optionGroups.map((g, gi) => ({ id: g.id, nameFa: g.nameFa, nameEn: g.nameEn, minSelect: g.minSelect, maxSelect: g.maxSelect, sort: gi, options: g.options.map((o, oi) => ({ id: o.id, nameFa: o.nameFa, nameEn: o.nameEn, priceDelta: o.priceDelta, isDefault: o.isDefault, isActive: true, sort: oi })) })),
    imageUrl: p.imageUrl,
  };
}

export default function MenuAdmin() {
  const toast = useToast();
  const cats = useLoad<{ categories: Cat[] }>('/api/staff/categories');
  const prods = useLoad<{ products: AdminProduct[] }>('/api/staff/products');
  const [form, setForm] = useState<Form | null>(null);
  const [cat, setCat] = useState<Partial<Cat> | null>(null);
  const { busy, error, run, setError } = useAction();
  const categories = cats.data?.categories ?? [];

  const saveProduct = async () => {
    if (!form) return;
    const body = {
      ...(form.slug ? { slug: form.slug } : {}), categoryId: form.categoryId, kind: form.kind, nameFa: form.nameFa, nameEn: form.nameEn, descFa: form.descFa, descEn: form.descEn,
      art: form.art, basePrice: form.basePrice, isActive: form.isActive, isFeatured: form.isFeatured, sort: form.sort,
      allergens: form.allergens.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      taste: form.tasted ? form.taste : null,
      optionGroups: form.optionGroups.map((g, gi) => ({ ...g, sort: gi, options: g.options.map((o, oi) => ({ ...o, sort: oi })) })),
    };
    const ok = await run(() => (form.id ? api(`/api/staff/products/${form.id}`, { method: 'PUT', json: body }) : api('/api/staff/products', { method: 'POST', json: body })));
    if (ok !== undefined) { toast('ذخیره شد'); setForm(null); void prods.reload(); }
  };

  const upload = async (file: File) => {
    if (!form?.id) return;
    const fd = new FormData();
    fd.append('file', file);
    const r = await run(() => api<{ imageUrl: string }>(`/api/staff/products/${form.id}/image`, { method: 'POST', body: fd }));
    if (r) { setForm({ ...form, imageUrl: r.imageUrl }); void prods.reload(); }
  };

  const saveCat = async () => {
    if (!cat) return;
    const body = { nameFa: cat.nameFa, nameEn: cat.nameEn, art: cat.art ?? null, sort: Number(cat.sort ?? 0), isActive: cat.isActive ?? true, ...(cat.slug && !cat.id ? { slug: cat.slug } : {}) };
    const ok = await run(() => (cat.id ? api(`/api/staff/categories/${cat.id}`, { method: 'PUT', json: body }) : api('/api/staff/categories', { method: 'POST', json: body })));
    if (ok !== undefined) { setCat(null); void cats.reload(); }
  };

  const upd = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const updGroup = (gi: number, patch: Partial<Group>) => upd({ optionGroups: form!.optionGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const updOpt = (gi: number, oi: number, patch: Partial<Opt>) => updGroup(gi, { options: form!.optionGroups[gi]!.options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });

  return (
    <>
      <div className="adm-top">
        <h1>منو و محصولات</h1>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => setCat({ nameFa: '', nameEn: '', sort: 0, isActive: true, art: 'glass' })}>دسته‌ی جدید</button>
        <button type="button" className="btn" disabled={!categories.length} onClick={() => { setError(null); setForm(blank(categories[0]!.id)); }}>محصول جدید</button>
      </div>
      <ErrorLine error={prods.error ?? cats.error} />
      <div className="panel">
        <h2>دسته‌ها</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {categories.map((c) => (
            <button type="button" key={c.id} className="chip" onClick={() => setCat(c)}>
              <Art name={c.art} style={{ width: 16, height: 20 }} />{c.nameFa} <small className="muted num">({(c._count?.products ?? 0).toLocaleString('fa-IR')})</small>{c.isActive ? '' : ' · غیرفعال'}
            </button>
          ))}
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th></th><th>نام</th><th>دسته</th><th>نوع</th><th className="end">قیمت پایه</th><th>وضعیت</th></tr></thead>
          <tbody>
            {prods.data?.products.map((p) => (
              <tr key={p.id} className="click" onClick={() => { setError(null); setForm(toForm(p)); }} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setForm(toForm(p))}>
                <td style={{ width: 44, color: 'var(--tada)' }}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 8 }} /> : <Art name={p.art} style={{ width: 22, height: 28 }} />}</td>
                <td><b>{p.nameFa}</b><br /><small className="muted">{p.nameEn}</small></td>
                <td>{categories.find((c) => c.id === p.categoryId)?.nameFa}</td>
                <td>{p.kind === 'DRINK' ? 'نوشیدنی' : p.kind === 'FOOD' ? 'خوراکی' : 'بسته‌بندی'}</td>
                <td className="end num">{toman(p.basePrice)}</td>
                <td>{p.isActive ? <span className="badge ok">فعال</span> : <span className="badge dark">آرشیو</span>}{p.isFeatured ? <span className="badge" style={{ marginInlineStart: 4 }}>ویژه</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={Boolean(cat)} onClose={() => setCat(null)} title={cat?.id ? 'ویرایش دسته' : 'دسته‌ی جدید'}>
        {cat ? (
          <div className="stack">
            <ErrorLine error={error} />
            <div className="form-grid">
              <label className="field"><span>نام فارسی</span><input className="input" value={cat.nameFa ?? ''} onChange={(e) => setCat({ ...cat, nameFa: e.target.value })} /></label>
              <label className="field"><span>نام انگلیسی</span><input className="input ltr" dir="ltr" value={cat.nameEn ?? ''} onChange={(e) => setCat({ ...cat, nameEn: e.target.value })} /></label>
              <label className="field"><span>ترتیب</span><input className="input num" type="number" value={cat.sort ?? 0} onChange={(e) => setCat({ ...cat, sort: Number(e.target.value) })} /></label>
              <label className="field"><span>طرح</span><select className="select" value={cat.art ?? 'glass'} onChange={(e) => setCat({ ...cat, art: e.target.value })}>{ARTS.map((a) => <option key={a}>{a}</option>)}</select></label>
            </div>
            <Switch checked={cat.isActive ?? true} onChange={(v) => setCat({ ...cat, isActive: v })} label="فعال" />
            <div className="row">
              <button type="button" className="btn" onClick={() => void saveCat()} disabled={busy || !cat.nameFa || !cat.nameEn}>ذخیره</button>
              {cat.id ? <button type="button" className="btn ghost" onClick={() => confirm('این دسته حذف شود؟') && void run(async () => { await api(`/api/staff/categories/${cat.id}`, { method: 'DELETE' }); setCat(null); await cats.reload(); })}>حذف</button> : null}
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? `ویرایش ${form.nameFa}` : 'محصول جدید'}>
        {form ? (
          <div className="stack" style={{ gap: 16 }}>
            <ErrorLine error={error} />
            <div className="form-grid">
              <label className="field"><span>نام فارسی</span><input className="input" value={form.nameFa} onChange={(e) => upd({ nameFa: e.target.value })} /></label>
              <label className="field"><span>نام انگلیسی</span><input className="input ltr" dir="ltr" value={form.nameEn} onChange={(e) => upd({ nameEn: e.target.value })} /></label>
              <label className="field"><span>دسته</span><select className="select" value={form.categoryId} onChange={(e) => upd({ categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.nameFa}</option>)}</select></label>
              <label className="field"><span>نوع</span><select className="select" value={form.kind} onChange={(e) => upd({ kind: e.target.value as Form['kind'], tasted: e.target.value !== 'PACKAGED' })}><option value="DRINK">نوشیدنی</option><option value="FOOD">خوراکی</option><option value="PACKAGED">بسته‌بندی</option></select></label>
              <TomanInput label="قیمت پایه" value={form.basePrice} onChange={(v) => upd({ basePrice: v ?? 0 })} />
              <label className="field"><span>ترتیب نمایش</span><input className="input num" type="number" value={form.sort} onChange={(e) => upd({ sort: Number(e.target.value) })} /></label>
              <label className="field full"><span>توضیح فارسی</span><textarea className="textarea" value={form.descFa} maxLength={600} onChange={(e) => upd({ descFa: e.target.value })} /></label>
              <label className="field full"><span>توضیح انگلیسی</span><textarea className="textarea ltr" dir="ltr" value={form.descEn} maxLength={600} onChange={(e) => upd({ descEn: e.target.value })} /></label>
              <label className="field"><span>حساسیت‌زاها (با ویرگول)</span><input className="input" value={form.allergens} onChange={(e) => upd({ allergens: e.target.value })} /></label>
              <label className="field"><span>نشانی (slug)</span><input className="input ltr" dir="ltr" value={form.slug} placeholder="خودکار" onChange={(e) => upd({ slug: e.target.value.toLowerCase() })} /></label>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 20 }}>
              <Switch checked={form.isActive} onChange={(v) => upd({ isActive: v })} label="فعال در منو" />
              <Switch checked={form.isFeatured} onChange={(v) => upd({ isFeatured: v })} label="محبوب (نمایش ویژه)" />
            </div>

            <div className="panel" style={{ margin: 0 }}>
              <h2>تصویر</h2>
              <p className="muted tiny">بدون عکس، طرح خطی تادا نمایش داده می‌شود.</p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {ARTS.map((a) => (
                  <button type="button" key={a} className="chip" aria-pressed={form.art === a} onClick={() => upd({ art: a })} title={a}><Art name={a} style={{ width: 18, height: 24 }} /></button>
                ))}
              </div>
              {form.id ? (
                <label className="field" style={{ marginTop: 10 }}>
                  <span>آپلود عکس (JPG، PNG یا WebP، حداکثر ۳ مگابایت)</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
                </label>
              ) : <p className="muted tiny">برای آپلود عکس، اول محصول را ذخیره کنید.</p>}
              {form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '60px 60px 10px 10px', marginTop: 8 }} /> : null}
            </div>

            {form.kind !== 'PACKAGED' ? (
              <div className="panel" style={{ margin: 0 }}>
                <h2>ذائقه (برای دستیار تادا)</h2>
                <Switch checked={form.tasted} onChange={(v) => upd({ tasted: v })} label="این محصول در پیشنهادهای دستیار باشد" />
                {form.tasted ? (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {(Object.keys(SCALE_LABELS) as (keyof typeof SCALE_LABELS)[]).map((k) => (
                      <label key={k} className="slider">
                        <span>{SCALE_LABELS[k]}</span>
                        <input type="range" min={0} max={5} value={form.taste[k]} onChange={(e) => upd({ taste: { ...form.taste, [k]: Number(e.target.value) } })} />
                        <output className="num">{form.taste[k].toLocaleString('fa-IR')}</output>
                      </label>
                    ))}
                    <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
                      <Switch checked={form.taste.milk} onChange={(v) => upd({ taste: { ...form.taste, milk: v } })} label="شیر دارد" />
                      <label className="field"><span>سرو</span><select className="select" value={form.taste.temperature} onChange={(e) => upd({ taste: { ...form.taste, temperature: e.target.value as 'HOT' } })}><option value="HOT">گرم</option><option value="ICED">سرد</option><option value="BOTH">هر دو</option></select></label>
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      {TASTE_NOTES.map((n) => {
                        const on = form.taste.notes.includes(n);
                        return <button type="button" key={n} className="chip" aria-pressed={on} onClick={() => upd({ taste: { ...form.taste, notes: on ? form.taste.notes.filter((x) => x !== n) : [...form.taste.notes, n].slice(0, 6) } })}>{NOTE_LABELS[n].fa}</button>;
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="panel" style={{ margin: 0 }}>
              <h2>انتخاب‌ها <span className="spacer" /><button type="button" className="btn ghost sm" onClick={() => upd({ optionGroups: [...form.optionGroups, { nameFa: '', nameEn: '', minSelect: 0, maxSelect: 1, sort: form.optionGroups.length, options: [{ nameFa: '', nameEn: '', priceDelta: 0, isDefault: false, isActive: true, sort: 0 }] }] })}>گروه جدید</button></h2>
              <div className="stack">
                {form.optionGroups.map((g, gi) => (
                  <div className="og" key={g.id ?? `new-${gi}`}>
                    <div className="form-grid">
                      <label className="field"><span>نام گروه</span><input className="input" value={g.nameFa} onChange={(e) => updGroup(gi, { nameFa: e.target.value })} /></label>
                      <label className="field"><span>Name</span><input className="input ltr" dir="ltr" value={g.nameEn} onChange={(e) => updGroup(gi, { nameEn: e.target.value })} /></label>
                      <label className="field"><span>حداقل</span><input className="input num" type="number" min={0} max={10} value={g.minSelect} onChange={(e) => updGroup(gi, { minSelect: Number(e.target.value) })} /></label>
                      <label className="field"><span>حداکثر</span><input className="input num" type="number" min={1} max={10} value={g.maxSelect} onChange={(e) => updGroup(gi, { maxSelect: Number(e.target.value) })} /></label>
                    </div>
                    <div className="opts">
                      {g.options.map((o, oi) => (
                        <div className="optrow" key={o.id ?? `o-${oi}`}>
                          <input className="input" aria-label="نام گزینه" placeholder="نام گزینه" value={o.nameFa} onChange={(e) => updOpt(gi, oi, { nameFa: e.target.value })} />
                          <input className="input ltr" dir="ltr" aria-label="Option name" placeholder="Option" value={o.nameEn} onChange={(e) => updOpt(gi, oi, { nameEn: e.target.value })} />
                          <input className="input num ltr" dir="ltr" aria-label="اختلاف قیمت (تومان)" placeholder="+ تومان" value={o.priceDelta ? String(o.priceDelta / 10) : ''} onChange={(e) => updOpt(gi, oi, { priceDelta: (Number(e.target.value.replace(/[^\d-]/g, '')) || 0) * 10 })} />
                          <label className="check tiny" style={{ minHeight: 0 }}><input type="checkbox" checked={o.isDefault} onChange={(e) => updOpt(gi, oi, { isDefault: e.target.checked })} />پیش‌فرض</label>
                          <button type="button" className="btn ghost sm" onClick={() => updGroup(gi, { options: g.options.filter((_, i) => i !== oi) })} disabled={g.options.length <= 1} aria-label="حذف گزینه">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="row">
                      <button type="button" className="btn ghost sm" onClick={() => updGroup(gi, { options: [...g.options, { nameFa: '', nameEn: '', priceDelta: 0, isDefault: false, isActive: true, sort: g.options.length }] })}>گزینه‌ی جدید</button>
                      <span className="spacer" />
                      <button type="button" className="btn ghost sm" onClick={() => upd({ optionGroups: form.optionGroups.filter((_, i) => i !== gi) })}>حذف گروه</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="row" style={{ position: 'sticky', bottom: -20, background: 'var(--paper)', padding: '12px 0' }}>
              <button type="button" className="btn" onClick={() => void saveProduct()} disabled={busy || !form.nameFa || !form.nameEn}>ذخیره‌ی محصول</button>
              {form.id ? <button type="button" className="btn ghost" onClick={() => confirm('حذف شود؟ اگر در سفارشی آمده باشد، آرشیو می‌شود.') && void run(async () => { await api(`/api/staff/products/${form.id}`, { method: 'DELETE' }); setForm(null); await prods.reload(); })}>حذف</button> : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
