'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';

export default function DemoPayment({ booking, token }: { booking: string; token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function approve() {
    setState('loading');
    const response = await fetch('/api/payments/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ booking, token }) });
    if (!response.ok) return setState('error');
    setState('done');
  }

  return <main className="demo-payment-page">
    <section className="demo-checkout">
      <Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link>
      <span className="demo-badge">Ambiente de demonstração</span>
      {state !== 'done' ? <>
        <span className="demo-payment-icon"><CreditCard size={25} /></span>
        <p className="booking-step-label">Checkout de apresentação</p>
        <h1>Pagamento do<br />sinal de 50%</h1>
        <p>Esta tela simula a aprovação que será feita pelo Mercado Pago quando as credenciais forem ativadas. Nenhuma cobrança real será realizada.</p>
        <div className="demo-security"><ShieldCheck size={17} /><span>Fluxo seguro · confirmação automática da reserva</span></div>
        {state === 'error' && <p className="booking-error">Não foi possível simular este pagamento.</p>}
        <button className="button button-dark" onClick={approve} disabled={state === 'loading' || !booking || !token}>{state === 'loading' ? 'Processando...' : 'Simular pagamento aprovado'}</button>
        <Link className="admin-login-back" href="/agendar">Cancelar e voltar</Link>
      </> : <>
        <span className="demo-payment-icon success"><Check size={26} /></span>
        <p className="booking-step-label">Pagamento demonstrativo aprovado</p>
        <h1>Reserva<br />confirmada.</h1>
        <p>O painel administrativo já recebeu a confirmação, registrou o sinal e atualizou a agenda.</p>
        <Link className="button button-dark" href={`/agendar?payment=success&booking=${encodeURIComponent(booking)}`}>Concluir</Link>
      </>}
    </section>
  </main>;
}
