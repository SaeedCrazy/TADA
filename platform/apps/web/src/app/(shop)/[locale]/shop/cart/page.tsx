import type { Metadata } from 'next';
import type { Locale } from '@tada/shared';
import { dict } from '@/lib/i18n';
import { CartView } from '@/components/shop/CartView';

export const metadata: Metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = locale as Locale;
  return (
    <main className="wrap page" id="main">
      <h1>{dict(l).cart.title}</h1>
      <CartView locale={l} />
    </main>
  );
}
