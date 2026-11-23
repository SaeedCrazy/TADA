import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import type { Menu } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Menu['products'] = [];
  try {
    products = (await api<Menu>('/api/menu', { revalidate: 300 })).products;
  } catch {
    // the sitemap still lists the main pages when the API is down
  }
  const pages = ['/shop', '/shop/assistant'];
  return [
    ...pages.flatMap((p) => [
      { url: `${SITE}${p}`, alternates: { languages: { fa: `${SITE}${p}`, en: `${SITE}/en${p}` } } },
    ]),
    ...products.map((p) => ({
      url: `${SITE}/shop/p/${p.slug}`,
      alternates: { languages: { fa: `${SITE}/shop/p/${p.slug}`, en: `${SITE}/en/shop/p/${p.slug}` } },
    })),
  ];
}
