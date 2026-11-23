import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@tada/shared';
import '@/styles/globals.css';
import '@/styles/shop.css';
import { dict, dirOf, isLocale } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui';
import { ShopHeader } from '@/components/shop/Header';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export function generateStaticParams() {
  return [{ locale: 'fa' }, { locale: 'en' }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = dict(isLocale(locale) ? locale : 'fa');
  return {
    metadataBase: new URL(SITE),
    title: { default: `${t.hero.title} | ${t.brand}`, template: `%s | ${t.brand}` },
    description: t.hero.lead,
    icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
    openGraph: { siteName: t.brand, images: ['/og-image.png'], locale: locale === 'fa' ? 'fa_IR' : 'en_US' },
  };
}

export const viewport: Viewport = { themeColor: '#1C0727', width: 'device-width', initialScale: 1 };

export default async function ShopLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const t = dict(l);
  return (
    <html lang={l} dir={dirOf(l)}>
      <body>
        <a href="#main" className="sr-only">{l === 'fa' ? 'پرش به محتوا' : 'Skip to content'}</a>
        <ToastProvider>
          <ShopHeader locale={l} />
          {children}
          <footer className="shop-footer">
            <div className="wrap inner">
              <img src="/brand/tada-wordmark-stacked_white.svg" alt={t.brand} />
              <span>{t.footer.hours}</span>
              <a href="https://www.instagram.com/tada_lounge/" rel="noopener noreferrer" target="_blank">{t.footer.insta}</a>
              <a href="/">{t.nav.site}</a>
              <span className="spacer" />
              <span>© {t.footer.rights}</span>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
