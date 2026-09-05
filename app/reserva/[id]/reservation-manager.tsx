'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, CreditCard, MessageCircle, ShieldCheck } from 'lucide-react';
import { BOOKING_TIMES } from '../../../lib/service-catalog';

type PublicBooking = { id: string; clientName: string; whatsapp: string; service: string; serviceLabel: string; appointmentDate: string; appointmentTime: string; status: string; paymentStatus: string; paymentProvider: string | null; priceCents: number; paymentAmountCents: number; balancePaidCents: number; paymentOption: 'deposit' | 'full'; expiresAt: number | null };

export default function ReservationManager({ token, initialBooking }: { token: string; initialBooking: PublicBooking }) {
  const [booking, setBooking] = useState(initialBooking);
  const [date, setDate] = useState(initialBooking.appointmentDate);
  const [time, setTime] = useState(initialBooking.appointmentTime);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const isPaid = booking.paymentStatus === 'pago';
  const isCancelled = booking.status === 'cancelado';
  const isExpired = booking.status === 'expirado';
  const openBalance = Math.max(0, booking.priceCents - booking.paymentAmountCents - booking.balancePaidCents);

  useEffect(() => {
    let active = true;
    fetch(`/api/bookings/availability?date=${encodeURIComponent(date)}&service=${encodeURIComponent(booking.service)}`)
      .then((response) => response.ok ? response.json() : { unavailable: [] })
      .then((result: { unavailable?: string[] }) => { if (active) setUnavailable((result.unavailable || []).filter((slot) => !(date === booking.appointmentDate && slot === booking.appointmentTime))); });
    return () => { active = false; };
  }, [date, booking.service, booking.appointmentDate, booking.appointmentTime]);

  async function action(name: 'cancel' | 'reschedule' | 'retry-payment') {
    if (name === 'cancel' && !window.confirm('Deseja solicitar o cancelamento desta reserva? Valores já pagos seguem a política de cancelamento.')) return;
    setBusy(name); setFeedback(null);
    try {
      const response = await fetch('/api/bookings/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: booking.id, token, action: name, date, time }) });
      const result = await response.json() as { error?: string; paymentUrl?: string; booking?: Partial<PublicBooking>; status?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a reserva.');
      if (result.paymentUrl) { window.location.href = result.paymentUrl; return; }
      if (name === 'cancel') setBooking((current) => ({ ...current, status: 'cancelado' }));
      if (result.booking) setBooking((current) => ({ ...current, ...result.booking }));
      setFeedback({ kind: 'success', message: name === 'cancel' ? 'Cancelamento registrado. Fale com Sávia para tratar valores já pagos.' : 'Reserva reagendada com sucesso.' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar a reserva.' });
    } finally { setBusy(''); }
  }

  return <main className="manage-page">
    <nav><Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link><Link href="/"><ArrowLeft size={14} /> Voltar ao site</Link></nav>
    <section className="manage-shell">
      <header><div><p className="eyebrow">Minha reserva</p><h1>Olá, {booking.clientName.split(' ')[0]}.</h1><p>Acompanhe o pagamento, confira o horário ou solicite uma alteração.</p></div><span className={`manage-status ${isCancelled ? 'cancelled' : isPaid ? 'paid' : isExpired ? 'expired' : ''}`}>{isPaid && !isCancelled ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}{isCancelled ? 'Reserva cancelada' : paymentLabel(booking.paymentStatus)}</span></header>
      {feedback && <p className={`manage-feedback ${feedback.kind}`}>{feedback.message}</p>}
      <div className="manage-grid">
        <section className="manage-card booking-card"><div className="manage-card-title"><CalendarDays size={18} /><h2>Atendimento</h2></div><strong>{booking.serviceLabel}</strong><dl><div><dt>Data</dt><dd>{formatDate(booking.appointmentDate)}</dd></div><div><dt>Horário</dt><dd>{booking.appointmentTime}</dd></div><div><dt>Código</dt><dd>{booking.id}</dd></div></dl></section>
        <section className="manage-card"><div className="manage-card-title"><CreditCard size={18} /><h2>Pagamento</h2></div><div className="manage-money"><div><small>Total</small><strong>{money(booking.priceCents)}</strong></div><div><small>Pago</small><strong>{money((isPaid ? booking.paymentAmountCents : 0) + booking.balancePaidCents)}</strong></div><div><small>Restante</small><strong>{money(isPaid ? openBalance : booking.priceCents)}</strong></div></div>{!isPaid && !isCancelled && <button className="button button-dark" disabled={busy === 'retry-payment'} onClick={() => void action('retry-payment')}>{busy === 'retry-payment' ? 'Preparando...' : isExpired ? 'Verificar horário e pagar' : 'Tentar pagamento novamente'}</button>}<p className="manage-small"><ShieldCheck size={13} /> Pagamento processado com segurança pela {booking.paymentProvider === 'infinitepay' ? 'InfinitePay' : booking.paymentProvider === 'mercado_pago' ? 'Mercado Pago' : 'plataforma de pagamento'}.</p></section>
        <section className="manage-card manage-reschedule"><div className="manage-card-title"><Clock3 size={18} /><h2>Reagendar</h2></div><p>Escolha uma nova data e um horário disponível.</p><label>Nova data<input type="date" min={today} value={date} disabled={isCancelled} onChange={(event) => { setDate(event.target.value); setTime(''); }} /></label><div className="manage-times">{BOOKING_TIMES.map((slot) => <button key={slot} type="button" disabled={isCancelled || unavailable.includes(slot)} className={time === slot ? 'active' : ''} onClick={() => setTime(slot)}>{slot}</button>)}</div><button className="button button-dark" disabled={isCancelled || !date || !time || busy === 'reschedule' || (date === booking.appointmentDate && time === booking.appointmentTime)} onClick={() => void action('reschedule')}>{busy === 'reschedule' ? 'Atualizando...' : 'Confirmar novo horário'}</button></section>
        <aside className="manage-support"><MessageCircle size={20} /><h2>Precisa de ajuda?</h2><p>Fale diretamente com Sávia para orientações, localização ou questões sobre cancelamento.</p><a href="https://wa.me/5581981747620" target="_blank" rel="noreferrer">Abrir WhatsApp</a></aside>
      </div>
      {!isCancelled && <button className="manage-cancel" disabled={busy === 'cancel'} onClick={() => void action('cancel')}>{busy === 'cancel' ? 'Cancelando...' : 'Solicitar cancelamento'}</button>}
      <p className="manage-legal">Ao alterar ou cancelar, você declara estar ciente dos <Link href="/termos">termos do agendamento</Link>.</p>
    </section>
  </main>;
}

function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function formatDate(value: string) { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function paymentLabel(status: string) { return ({ pago: 'Reserva confirmada', aguardando: 'Aguardando pagamento', em_analise: 'Pagamento em análise', rejeitado: 'Pagamento recusado', expirado: 'Pré-reserva expirada', cancelado: 'Cancelada', estornado: 'Pagamento estornado', configuracao_pendente: 'Pagamento indisponível' } as Record<string, string>)[status] || status; }
