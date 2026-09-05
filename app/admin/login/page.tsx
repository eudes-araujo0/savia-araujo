import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '../../../lib/admin-auth';
import { listSiteMedia } from '../../../db/media';
import { defaultMediaValue, getMediaSlot, managedMediaStyle } from '../../../lib/site-media';
import AdminLoginForm from './login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acesso administrativo | Sávia Araújo',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin');
  const fallback = defaultMediaValue(getMediaSlot('admin.login-cover')!);
  const loginMedia = await listSiteMedia().then((items) => items.find((item) => item.slotId === 'admin.login-cover') || fallback).catch(() => fallback);
  return (
    <main className="admin-login-page">
      <section className="admin-login-visual">
        <Image className="managed-media" src={loginMedia.url} alt={loginMedia.alt} fill sizes="(max-width: 760px) 100vw, 45vw" preload style={managedMediaStyle(loginMedia)} />
        <Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link>
        <div><p className="eyebrow">Área reservada</p><h1>Gestão com<br /><em>elegância.</em></h1></div>
      </section>
      <section className="admin-login-shell">
        <AdminLoginForm />
      </section>
    </main>
  );
}
