import type { Locale } from '@tada/shared';
import { api } from '@/lib/api';
import type { Branch, Menu } from '@/lib/types';
import { MenuView } from '@/components/shop/MenuView';

export const dynamic = 'force-dynamic';

export default async function ShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [menu, { branches }] = await Promise.all([
    api<Menu>('/api/menu', { revalidate: 30 }),
    api<{ branches: Branch[] }>('/api/branches'),
  ]);
  return <MenuView locale={locale as Locale} initial={menu} branches={branches} />;
}
