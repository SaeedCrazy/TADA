'use client';
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, formatToman } from '@tada/shared';
import type { Order } from '@/lib/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Prints an 80 mm receipt for the bar printer using a hidden block and the browser print dialog. */
export function printReceipt(o: Order) {
  const el = document.createElement('div');
  el.className = 'receipt';
  el.innerHTML = `
    <h3>تادا · شعبه‌ی ${esc(o.branch.nameFa)}</h3>
    <p style="text-align:center;margin:0 0 6px">سفارش #${o.number} · ${esc(ORDER_TYPE_LABELS[o.type].fa)}${o.table ? ` · میز ${o.table.number}` : ''}</p>
    <p style="margin:0 0 6px">${esc(o.customerName)} · ${new Date(o.createdAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}</p>
    <table>${o.items.map((i) => `<tr><td>${i.quantity}×</td><td>${esc(i.nameFa)}${i.options.length ? `<br><small>${esc(i.options.map((x) => x.nameFa).join('، '))}</small>` : ''}${i.note ? `<br><small>«${esc(i.note)}»</small>` : ''}</td><td style="text-align:left">${formatToman(i.lineTotal, 'fa')}</td></tr>`).join('')}</table>
    <hr><p style="margin:0">جمع: ${formatToman(o.total, 'fa')} · ${esc(PAYMENT_METHOD_LABELS[o.paymentMethod].fa)} · ${o.paymentStatus === 'PAID' ? 'پرداخت شده' : 'پرداخت نشده'}</p>
    ${o.addressText ? `<p style="margin:4px 0 0">${esc(o.addressText)}</p>` : ''}
    ${o.note ? `<p style="margin:4px 0 0">یادداشت: ${esc(o.note)}</p>` : ''}
    <p style="text-align:center;margin-top:8px">نوش جان!</p>`;
  document.body.appendChild(el);
  document.body.classList.add('printing');
  const done = () => {
    document.body.classList.remove('printing');
    el.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 60_000);
}
