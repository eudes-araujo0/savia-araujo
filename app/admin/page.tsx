import type { Metadata } from 'next';
import { listBookings } from '../../db/bookings';
import { requireAdminSession } from '../../lib/admin-auth';
import AdminDashboard from './admin-dashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Painel administrativo | Sávia Araújo',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await requireAdminSession('/admin');
  const bookings = await listBookings();

  return (
    <AdminDashboard
      initialBookings={bookings}
      username={session.username}
      signOutPath="/api/admin/session"
    />
  );
}
