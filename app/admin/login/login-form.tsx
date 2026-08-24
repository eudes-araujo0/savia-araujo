'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
      router.replace('/admin');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-login-card" onSubmit={submit}>
      <span className="admin-login-icon"><LockKeyhole size={20} /></span>
      <p className="booking-step-label">Painel administrativo</p>
      <h2>Bem-vinda,<br />Sávia.</h2>
      <p className="admin-login-copy">Entre com seu usuário e senha para acessar agenda, clientes, pagamentos e comprovantes.</p>
      <div className="form-field"><label htmlFor="admin-user">Usuário</label><input id="admin-user" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
      <div className="form-field"><label htmlFor="admin-password">Senha</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
      {error && <p className="booking-error" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Entrando...' : 'Entrar no painel'} <ArrowRight size={15} /></button>
      <Link className="admin-login-back" href="/">Voltar ao site</Link>
    </form>
  );
}
