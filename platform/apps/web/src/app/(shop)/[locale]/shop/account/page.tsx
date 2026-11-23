import type { Metadata } from 'next';
import type { Locale } from '@tada/shared';
import { dict } from '@/lib/i18n';
import { Account } from '@/components/shop/Account';

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = locale as Locale;
  return (
    <main className="wrap page" id="main">
      <h1>{dict(l).account.title}</h1>
      <Account locale={l} />
    </main>
  );
}
