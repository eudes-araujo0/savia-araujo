import type { Metadata } from 'next';
import { listBookings, listExpenses, listScheduleBlocks } from '../../db/bookings';
import { listSiteMedia } from '../../db/media';
import { requireAdminSession } from '../../lib/admin-auth';
import AdminDashboard from './admin-dashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Painel administrativo | Sávia Araújo',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await requireAdminSession('/admin');
  const [bookings, expenses, blocks, initialMedia] = await Promise.all([
    listBookings(),
    listExpenses(),
    listScheduleBlocks(),
    listSiteMedia().catch(() => []),
  ]);

  return (
    <AdminDashboard
      initialBookings={bookings}
      initialExpenses={expenses}
      initialBlocks={blocks}
      initialMedia={initialMedia}
      username={session.username}
      signOutPath="/api/admin/session"
    />
  );
}
