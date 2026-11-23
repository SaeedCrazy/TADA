import type { Metadata } from 'next';
import type { Locale } from '@tada/shared';
import { api } from '@/lib/api';
import type { Branch } from '@/lib/types';
import { dict } from '@/lib/i18n';
import { Checkout } from '@/components/shop/Checkout';

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = locale as Locale;
  const { branches } = await api<{ branches: Branch[] }>('/api/branches');
  return (
    <main className="wrap page" id="main">
      <h1>{dict(l).checkout.title}</h1>
      <Checkout locale={l} branches={branches} />
    </main>
  );
}
