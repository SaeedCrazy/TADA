import { NextResponse, type NextRequest } from 'next/server';

// Persian is the default and lives at /shop; English lives at /en/shop. Internally both are /[locale]/...
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/' || pathname === '/fa' || pathname === '/en') {
    return NextResponse.redirect(new URL(pathname === '/en' ? '/en/shop' : '/shop', req.url));
  }
  if (pathname.startsWith('/fa/')) {
    return NextResponse.redirect(new URL(pathname.slice(3) + search, req.url), 308);
  }
  if (pathname.startsWith('/shop') || pathname.startsWith('/t/')) {
    return NextResponse.rewrite(new URL(`/fa${pathname}${search}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/fa', '/en', '/fa/:path*', '/shop/:path*', '/shop', '/t/:path*'],
};
