import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import '@/styles/admin.css';
import { ToastProvider } from '@/components/ui';

export const metadata: Metadata = {
  title: { default: 'پنل تادا', template: '%s | پنل تادا' },
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
  referrer: 'no-referrer',
};
export const viewport: Viewport = { themeColor: '#1C0727', width: 'device-width', initialScale: 1 };

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
