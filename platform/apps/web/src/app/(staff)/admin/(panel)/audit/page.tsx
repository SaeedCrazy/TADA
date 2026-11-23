'use client';
import { useState } from 'react';
import { ErrorLine, Pager, faDate, useLoad } from '@/components/admin/kit';

interface Log { id: string; action: string; entity: string; entityId: string | null; data: unknown; ip: string | null; createdAt: string; staff: { name: string; username: string } | null }

const LABELS: Record<string, string> = {
  'staff.login': 'ورود', 'staff.login_failed': 'ورود ناموفق', 'order.status': 'تغییر وضعیت سفارش', 'order.mark_paid': 'ثبت پرداخت', 'order.refunded': 'بازگشت وجه',
  'product.create': 'محصول جدید', 'product.update': 'ویرایش محصول', 'product.delete': 'حذف محصول', 'product.archive': 'آرشیو محصول', 'product.image': 'عکس محصول',
  'availability.update': 'موجودی', 'branch.ordering': 'توقف/شروع سفارش شعبه', 'discount.create': 'کد تخفیف جدید', 'staff.create': 'همکار جدید', 'staff.update': 'ویرایش همکار',
  'customer.block': 'مسدودسازی مشتری', 'customer.unblock': 'رفع مسدودی', 'accounting.export': 'خروجی CSV', 'table.rotate': 'کد تازه‌ی میز', 'setting.update': 'تنظیمات',
};

export default function AuditAdmin() {
  const [page, setPage] = useState(1);
  const list = useLoad<{ logs: Log[]; total: number; page: number; pageSize: number }>(`/api/staff/audit?page=${page}`);
  return (
    <>
      <div className="adm-top"><h1>گزارش تغییرات</h1></div>
      <ErrorLine error={list.error} />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>زمان</th><th>همکار</th><th>کار</th><th>جزئیات</th><th>IP</th></tr></thead>
          <tbody>
            {list.data?.logs.map((l) => (
              <tr key={l.id}>
                <td className="tiny">{faDate(l.createdAt)}</td>
                <td>{l.staff?.name ?? '—'}</td>
                <td>{LABELS[l.action] ?? l.action}</td>
                <td className="tiny" dir="ltr" style={{ textAlign: 'end', maxWidth: 320, wordBreak: 'break-word' }}>{l.data ? JSON.stringify(l.data) : ''}</td>
                <td className="tiny num" dir="ltr">{l.ip ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data ? <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /> : null}
    </>
  );
}
