import type { Metadata } from 'next';
import type { Locale } from '@tada/shared';
import { dict } from '@/lib/i18n';
import { Assistant } from '@/components/shop/Assistant';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = dict(locale as Locale);
  return { title: t.assistant.title, description: t.assistant.lead };
}

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <main className="wrap page" id="main">
      <Assistant locale={locale as Locale} />
    </main>
  );
}
