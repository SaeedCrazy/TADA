import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/shop', '/en/shop'], disallow: ['/admin', '/bar', '/api', '/t/', '/shop/checkout', '/shop/account', '/shop/orders'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
