import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '../../../lib/admin-auth';
import AdminLoginForm from './login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acesso administrativo | Sávia Araújo',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin');
  return (
    <main className="admin-login-page">
      <section className="admin-login-visual">
        <img src="/media/savia-admin.jpg" alt="Sávia Araújo" />
        <Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link>
        <div><p className="eyebrow">Área reservada</p><h1>Gestão com<br /><em>elegância.</em></h1></div>
      </section>
      <section className="admin-login-shell">
        <AdminLoginForm />
      </section>
    </main>
  );
}
