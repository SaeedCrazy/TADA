import type { NextConfig } from 'next';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const isDev = process.env.NODE_ENV !== 'production';
const tiles = process.env.NEXT_PUBLIC_MAP_TILE_HOST ?? 'https://*.tile.openstreetmap.org';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${tiles}`,
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['@tada/shared'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default config;
