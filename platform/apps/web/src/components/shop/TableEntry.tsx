'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Locale } from '@tada/shared';
import type { Branch } from '@/lib/types';
import { cart } from '@/lib/cart';
import { dict, href } from '@/lib/i18n';
import { Art } from '../ui';

/** Scanning a table QR remembers the table (and its branch) for a few hours, then opens the menu. */
export function TableEntry({ locale, token, number, branch }: { locale: Locale; token: string; number: number; branch: Branch }) {
  const router = useRouter();
  const t = dict(locale);
  useEffect(() => {
    cart.setTable({ token, number, branchId: branch.id, branchFa: branch.nameFa, branchEn: branch.nameEn });
    const id = setTimeout(() => router.replace(href(locale, '/shop')), 900);
    return () => clearTimeout(id);
  }, [token, number, branch, locale, router]);
  return (
    <main className="wrap page" id="main">
      <div className="empty-state">
        <Art name="hand" style={{ color: 'var(--tada)' }} />
        <h1 style={{ fontSize: 26 }}>{t.table.at(number, locale === 'fa' ? branch.nameFa : branch.nameEn)}</h1>
        <p>{t.common.loading}</p>
      </div>
    </main>
  );
}
