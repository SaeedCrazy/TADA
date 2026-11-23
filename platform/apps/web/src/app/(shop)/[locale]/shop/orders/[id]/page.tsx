import type { Metadata } from 'next';
import type { Locale } from '@tada/shared';
import { OrderTracker } from '@/components/shop/OrderTracker';

export const metadata: Metadata = { robots: { index: false }, referrer: 'no-referrer' };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ t?: string; paid?: string }> }) {
  const { locale, id } = await params;
  const { t, paid } = await searchParams;
  return (
    <main className="wrap page" id="main">
      <OrderTracker locale={locale as Locale} id={id} token={t ?? null} paid={paid ?? null} />
    </main>
  );
}
