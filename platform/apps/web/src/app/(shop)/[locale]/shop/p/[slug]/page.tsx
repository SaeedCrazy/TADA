import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatToman, type Locale } from '@tada/shared';
import { api, isApiError } from '@/lib/api';
import type { Product } from '@/lib/types';
import { dict, href } from '@/lib/i18n';
import { ProductDetail } from '@/components/shop/ProductDetail';

export const dynamic = 'force-dynamic';

async function load(slug: string): Promise<Product | null> {
  try {
    return (await api<{ product: Product }>(`/api/products/${encodeURIComponent(slug)}`, { revalidate: 30 })).product;
  } catch (e) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p) return {};
  const name = locale === 'fa' ? p.nameFa : p.nameEn;
  return {
    title: name,
    description: (locale === 'fa' ? p.descFa : p.descEn) || name,
    alternates: { canonical: href(locale as Locale, `/shop/p/${p.slug}`), languages: { fa: `/shop/p/${p.slug}`, en: `/en/shop/p/${p.slug}` } },
    openGraph: { title: name, description: locale === 'fa' ? p.descFa : p.descEn },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const l = locale as Locale;
  const p = await load(slug);
  if (!p) notFound();
  const t = dict(l);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l === 'fa' ? p.nameFa : p.nameEn,
    description: l === 'fa' ? p.descFa : p.descEn,
    brand: { '@type': 'Brand', name: 'Tada Lounge' },
    offers: { '@type': 'Offer', priceCurrency: 'IRR', price: p.price, availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };
  return (
    <main className="wrap" id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <p style={{ paddingTop: 16 }}><Link href={href(l, '/shop')} className="btn ghost sm">{t.product.back}</Link></p>
      <ProductDetail p={p} locale={l} priceText={formatToman(p.price, l)} />
    </main>
  );
}
