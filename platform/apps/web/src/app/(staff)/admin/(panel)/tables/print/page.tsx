'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useLoad, useStaff } from '@/components/admin/kit';

interface Table { id: string; number: number; isActive: boolean; url: string }

function Sheet() {
  const sp = useSearchParams();
  const branchId = sp.get('branch');
  const { branches } = useStaff();
  const list = useLoad<{ tables: Table[] }>(branchId ? `/api/staff/branches/${branchId}/tables` : null);
  const branch = branches.find((b) => b.id === branchId);
  return (
    <>
      <div className="adm-top no-print"><h1>برگه‌ی QR · {branch?.nameFa}</h1><span className="spacer" /><button type="button" className="btn" onClick={() => window.print()}>چاپ</button></div>
      <div className="qrcards">
        {list.data?.tables.filter((t) => t.isActive).map((t) => (
          <div className="qrcard" key={t.id}>
            <img src="/brand/tada-wordmark-stacked_purple.svg" alt="تادا" style={{ height: 40 }} />
            <img className="q" src={`/api/staff/tables/${t.id}/qr.svg?v=${encodeURIComponent(t.url.slice(-6))}`} alt="" />
            <span className="n num">میز {t.number.toLocaleString('fa-IR')}</span>
            <small style={{ color: 'var(--soft)' }}>اسکن کنید، سفارش بدهید، بقیه‌اش با ما.</small>
          </div>
        ))}
      </div>
    </>
  );
}

export default function PrintPage() {
  return <Suspense><Sheet /></Suspense>;
}
