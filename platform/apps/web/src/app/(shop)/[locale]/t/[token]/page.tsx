import type { Metadata } from 'next';
import type { Locale } from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import type { Branch } from '@/lib/types';
import { dict, errorText } from '@/lib/i18n';
import { TableEntry } from '@/components/shop/TableEntry';

export const metadata: Metadata = { robots: { index: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function TablePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const l = locale as Locale;
  try {
    const r = await api<{ table: { number: number }; branch: Branch }>(`/api/tables/${encodeURIComponent(token)}`);
    return <TableEntry locale={l} token={token} number={r.table.number} branch={r.branch} />;
  } catch (e) {
    return (
      <main className="wrap page" id="main">
        <p className="alert bad">{errorText(l, isApiError(e) ? e.code : undefined)}</p>
        <p style={{ marginTop: 16 }}><a className="btn" href={l === 'fa' ? '/shop' : '/en/shop'}>{dict(l).cart.toMenu}</a></p>
      </main>
    );
  }
}
