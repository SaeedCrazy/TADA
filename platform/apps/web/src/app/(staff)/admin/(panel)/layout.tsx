import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/Shell';

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
