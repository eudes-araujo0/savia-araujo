'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, CircleDollarSign, Clock3, LayoutDashboard, ReceiptText, RefreshCw, Search, Sparkles, Users } from 'lucide-react';
import type { Booking } from '../../db/schema';

type View = 'visao-geral' | 'agenda' | 'clientes' | 'clientes-pendentes' | 'financeiro' | 'comprovantes';

type Props = {
  initialBookings: Booking[];
  username: string;
  signOutPath: string;
};

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'clientes-pendentes', label: 'Clientes pendentes', icon: Clock3 },
  { id: 'financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { id: 'comprovantes', label: 'Comprovantes', icon: ReceiptText },
];

export default function AdminDashboard({ initialBookings, username, signOutPath }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [view, setView] = useState<View>('visao-geral');
  const [query, setQuery] = useState('');
  const [agendaDate, setAgendaDate] = useState(todayInSaoPaulo());
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPayment, setBusyPayment] = useState('');
  const today = useMemo(() => todayInSaoPaulo(), []);

  const refreshBookings = useCallback(async (successMessage = '') => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/bookings', { cache: 'no-store' });
      const result = await response.json() as { bookings?: Booking[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o painel.');
      setBookings(result.bookings || []);
      if (successMessage) setFeedback({ kind: 'success', message: successMessage });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar o painel.' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => { void refreshBookings(); };
    window.addEventListener('focus', handleFocus);
    const interval = window.setInterval(() => { void refreshBookings(); }, 30000);
    return () => { window.removeEventListener('focus', handleFocus); window.clearInterval(interval); };
  }, [refreshBookings]);

  const activeBookings = useMemo(() => bookings.filter((booking) => booking.status !== 'cancelado'), [bookings]);
  const paidBookings = useMemo(() => activeBookings.filter((booking) => booking.paymentStatus === 'pago'), [activeBookings]);
  const pendingBookings = useMemo(() => activeBookings.filter((booking) => booking.paymentStatus !== 'pago'), [activeBookings]);
  const filteredBookings = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return bookings;
    return bookings.filter((booking) => [booking.clientName, booking.whatsapp, booking.email || '', booking.serviceLabel, booking.id].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized)));
  }, [bookings, query]);

  const periodStats = useMemo(() => {
    const todayDate = new Date(`${today}T12:00:00Z`);
    const monday = addDays(todayDate, -((todayDate.getUTCDay() + 6) % 7));
    const sunday = addDays(monday, 6);
    const ranges = [
      { label: 'Faturamento hoje', predicate: (booking: Booking) => booking.appointmentDate === today, note: 'valor contratado' },
      { label: 'Esta semana', predicate: (booking: Booking) => booking.appointmentDate >= iso(monday) && booking.appointmentDate <= iso(sunday), note: `${iso(monday).slice(8)}/${iso(monday).slice(5, 7)} a ${iso(sunday).slice(8)}/${iso(sunday).slice(5, 7)}` },
      { label: 'Este mês', predicate: (booking: Booking) => booking.appointmentDate.startsWith(today.slice(0, 7)), note: 'valor contratado' },
      { label: 'No ano', predicate: (booking: Booking) => booking.appointmentDate.startsWith(today.slice(0, 4)), note: 'valor contratado' },
    ];
    return ranges.map((range) => {
      const period = paidBookings.filter(range.predicate);
      return { ...range, value: money(sum(period, 'paymentAmountCents')), count: period.length };
    });
  }, [paidBookings, today]);

  const financial = useMemo(() => {
    const received = sum(paidBookings, 'paymentAmountCents');
    const contracted = sum(paidBookings, 'priceCents');
    const fullReceived = paidBookings.filter((booking) => booking.paymentOption === 'full').reduce((total, booking) => total + booking.paymentAmountCents, 0);
    const outstanding = paidBookings.reduce((total, booking) => total + Math.max(0, booking.priceCents - booking.paymentAmountCents), 0);
    return { paid: paidBookings, received, contracted, fullReceived, outstanding };
  }, [paidBookings]);

  const agendaBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate === agendaDate), [activeBookings, agendaDate]);
  const todayBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate === today), [activeBookings, today]);
  const clients = useMemo(() => groupClients(paidBookings), [paidBookings]);
  const chart = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(`${today}T12:00:00Z`), index - 6);
    const dateIso = iso(date);
    const value = financial.paid.filter((booking) => booking.paidAt && todayFromTimestamp(booking.paidAt) === dateIso).reduce((total, booking) => total + booking.paymentAmountCents, 0);
    return { date: dateIso, label: weekday(date), value };
  }), [financial.paid, today]);
  const maxChart = Math.max(...chart.map((item) => item.value), 1);

  async function changeStatus(id: string, status: string) {
    const before = bookings;
    setFeedback(null);
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
    const response = await fetch('/api/bookings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setBookings(before);
      setFeedback({ kind: 'error', message: result.error || 'Não foi possível alterar o status.' });
      return;
    }
    await refreshBookings('Status do atendimento atualizado.');
  }

  async function changePayment(id: string, action: 'sync' | 'manual-paid') {
    if (action === 'manual-paid' && !window.confirm('Confirmar manualmente que este pagamento foi recebido?')) return;
    setBusyPayment(id);
    setFeedback(null);
    try {
      const response = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId: id, action }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível conferir o pagamento.');
      await refreshBookings(action === 'manual-paid' ? 'Pagamento confirmado manualmente.' : 'Pagamento sincronizado com o Mercado Pago.');
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível conferir o pagamento.' });
    } finally {
      setBusyPayment('');
    }
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link>
        <nav className="admin-nav" aria-label="Painel administrativo">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={15} /> {label}</button>
          ))}
        </nav>
        <div className="admin-owner-card">
          <Image src="/media/savia-admin.jpg" alt="Retrato de Sávia Araújo" fill sizes="240px" />
          <div><strong>Sávia Araújo</strong><small>Makeup Artist</small></div>
        </div>
        <div className="admin-user"><strong>{username}</strong><small>Administradora</small><a href={signOutPath}>Sair do painel</a></div>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div><p>{longDate(today)}</p><h1>{navigation.find((item) => item.id === view)?.label}</h1></div>
          <div className="admin-header-actions"><span className="admin-date">{bookings.length} agendamentos registrados</span><button className="admin-refresh" onClick={() => void refreshBookings('Painel atualizado.')} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'spinning' : ''} /> Atualizar</button></div>
        </header>
        {feedback && <p className={`admin-feedback ${feedback.kind}`}>{feedback.message}</p>}

        {view === 'visao-geral' && <>
          {!bookings.length && <p className="admin-demo-banner">O painel está pronto e conectado ao banco. Faça um agendamento de demonstração pelo site para ver o fluxo completo aparecer aqui.</p>}
          <div className="stat-grid">
            {periodStats.map(({ label, value, note, count }, index) => {
              const Icon = [CircleDollarSign, CalendarDays, Users, Sparkles][index];
              return <article className="stat-card" key={label}><div className="stat-card-head"><span>{label}</span><Icon size={15} /></div><strong>{value}</strong><small>{count} {count === 1 ? 'agendamento' : 'agendamentos'} · {note}</small></article>;
            })}
          </div>
          <div className="admin-grid">
            <section className="admin-panel">
              <div className="panel-head"><h2>Agenda de hoje</h2><button onClick={() => setView('agenda')}>Ver agenda</button></div>
              <AppointmentList bookings={todayBookings} onStatusChange={changeStatus} />
            </section>
            <section className="admin-panel">
              <div className="panel-head"><h2>Caixa</h2><button onClick={() => setView('financeiro')}>Ver financeiro</button></div>
              <div className="finance-summary compact">
                <div><small>Sinais recebidos</small><strong>{money(financial.received)}</strong></div>
                <div><small>Saldo a receber</small><strong>{money(financial.outstanding)}</strong></div>
              </div>
            </section>
          </div>
          <section className="admin-panel admin-full">
            <div className="panel-head"><h2>Agendamentos recentes</h2><span>{bookings.length} registros</span></div>
            <BookingsTable bookings={bookings.slice(0, 8)} onStatusChange={changeStatus} />
          </section>
        </>}

        {view === 'agenda' && <section className="admin-panel admin-view-panel">
          <div className="panel-head panel-controls"><div><h2>Agenda por dia</h2><span>Selecione uma data para organizar os horários</span></div><input type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} /></div>
          <AppointmentList bookings={agendaBookings} onStatusChange={changeStatus} showPayment />
        </section>}

        {view === 'clientes' && <>
          <div className="admin-search"><Search size={15} /><input aria-label="Buscar clientes" placeholder="Buscar por nome, WhatsApp, e-mail ou serviço" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <section className="client-grid">
            {clients.filter((client) => !query || [client.name, client.whatsapp, client.email].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map((client) => (
              <article className="client-card" key={client.key}><span>{initials(client.name)}</span><div><h2>{client.name}</h2><p>{client.whatsapp}{client.email ? ` · ${client.email}` : ''}</p><small>{client.bookings} {client.bookings === 1 ? 'atendimento' : 'atendimentos'} · {money(client.value)} contratados</small></div></article>
            ))}
            {!clients.length && <div className="empty-state">Os clientes aparecerão aqui após o pagamento ser aprovado.</div>}
          </section>
          {!!filteredBookings.length && <section className="admin-panel admin-full"><div className="panel-head"><h2>Histórico dos clientes</h2><span>{filteredBookings.length} registros</span></div><BookingsTable bookings={filteredBookings} onStatusChange={changeStatus} /></section>}
        </>}

        {view === 'clientes-pendentes' && <section className="admin-panel admin-view-panel">
          <div className="panel-head"><div><h2>Clientes pendentes</h2><span>Solicitações ainda sem pagamento aprovado</span></div><strong>{pendingBookings.length}</strong></div>
          <PendingClients bookings={pendingBookings} busyPayment={busyPayment} onPaymentAction={changePayment} />
        </section>}

        {view === 'financeiro' && <>
          <div className="finance-summary">
            <article><small>Contratado confirmado</small><strong>{money(financial.contracted)}</strong><span>somente reservas pagas</span></article>
            <article><small>Recebido pelo site</small><strong>{money(financial.received)}</strong><span>sinais e pagamentos integrais aprovados</span></article>
            <article><small>Integrais recebidos</small><strong>{money(financial.fullReceived)}</strong><span>reservas quitadas pelo site</span></article>
            <article><small>Saldo a receber</small><strong>{money(financial.outstanding)}</strong><span>restante dos sinais já pagos</span></article>
          </div>
          <section className="admin-panel admin-full">
            <div className="panel-head"><h2>Entradas nos últimos 7 dias</h2><span>pagamentos aprovados</span></div>
            <div className="revenue-chart tall-chart" aria-label="Entradas dos últimos sete dias">
              {chart.map((item) => <div className="chart-bar" key={item.date}><strong>{item.value ? money(item.value) : ''}</strong><i style={{ height: `${Math.max(5, item.value / maxChart * 100)}%` }} /><span>{item.label}</span></div>)}
            </div>
          </section>
          <section className="admin-panel admin-full"><div className="panel-head"><h2>Movimentação por reserva</h2><span>{paidBookings.length} pagamentos aprovados</span></div><FinanceTable bookings={paidBookings} /></section>
        </>}

        {view === 'comprovantes' && <section className="admin-panel admin-view-panel">
          <div className="panel-head"><div><h2>Pagamentos e comprovantes</h2><span>Sinal de 50% ou valor integral, conforme a escolha da cliente</span></div></div>
          <div className="payment-list">
            {bookings.map((booking) => (
              <article className="payment-row" key={booking.id}>
                <div><strong>{booking.clientName}</strong><small>{booking.id} · {booking.serviceLabel}</small></div>
                <div><small>{booking.paymentOption === 'full' ? 'Integral' : 'Sinal 50%'}</small><strong>{booking.paymentAmountCents ? money(booking.paymentAmountCents) : 'Sob consulta'}</strong></div>
                <span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span>
                <div className="payment-proof">
                  {booking.paymentId && <small>{booking.paymentProvider === 'demo' ? 'Demonstração' : 'Mercado Pago'} · {booking.paymentId}</small>}
                  {booking.receiptKey && <a className="receipt-link" href={`/api/receipts/${booking.id}`} target="_blank">Abrir comprovante enviado</a>}
                  {!booking.paymentId && !booking.receiptKey && <small>Aguardando pagamento</small>}
                  {booking.paymentStatus !== 'pago' && <PaymentActions booking={booking} busy={busyPayment === booking.id} onAction={changePayment} />}
                </div>
              </article>
            ))}
            {!bookings.length && <div className="empty-state">Nenhum pagamento registrado.</div>}
          </div>
        </section>}
      </section>
    </main>
  );
}

function AppointmentList({ bookings, onStatusChange, showPayment = false }: { bookings: Booking[]; onStatusChange: (id: string, status: string) => void; showPayment?: boolean }) {
  if (!bookings.length) return <div className="empty-state">Nenhum atendimento nesta data.</div>;
  return <div className="appointment-list">{bookings.map((booking) => (
    <div className="appointment-row" key={booking.id}>
      <span className="appointment-time">{booking.appointmentTime}</span>
      <div className="appointment-client"><strong>{booking.clientName}</strong><small>{booking.serviceLabel} · {booking.whatsapp}{showPayment ? ` · ${paymentLabel(booking.paymentStatus)}` : ''}</small></div>
      <select aria-label={`Status de ${booking.clientName}`} value={booking.status} onChange={(event) => onStatusChange(booking.id, event.target.value)}>
        <option value="pendente">Pendente</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option>
      </select>
    </div>
  ))}</div>;
}

function BookingsTable({ bookings, onStatusChange }: { bookings: Booking[]; onStatusChange: (id: string, status: string) => void }) {
  if (!bookings.length) return <div className="empty-state">Nenhum agendamento registrado.</div>;
  return <div className="bookings-table-wrap"><table className="bookings-table"><thead><tr><th>Cliente</th><th>Data</th><th>Serviço</th><th>Valor</th><th>Pagamento</th><th>Status</th></tr></thead><tbody>{bookings.map((booking) => (
    <tr key={booking.id}><td>{booking.clientName}<br /><small>{booking.whatsapp}</small></td><td>{formatDate(booking.appointmentDate)} · {booking.appointmentTime}</td><td>{booking.serviceLabel}</td><td>{booking.priceCents ? money(booking.priceCents) : 'A definir'}</td><td><span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span></td><td><select aria-label={`Status de ${booking.clientName}`} value={booking.status} onChange={(event) => onStatusChange(booking.id, event.target.value)}><option value="pendente">Pendente</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option></select></td></tr>
  ))}</tbody></table></div>;
}

function FinanceTable({ bookings }: { bookings: Booking[] }) {
  if (!bookings.length) return <div className="empty-state">Nenhuma movimentação financeira.</div>;
  return <div className="bookings-table-wrap"><table className="bookings-table"><thead><tr><th>Cliente</th><th>Serviço</th><th>Total</th><th>Opção</th><th>Recebido</th><th>Saldo</th></tr></thead><tbody>{bookings.map((booking) => (
    <tr key={booking.id}><td>{booking.clientName}</td><td>{booking.serviceLabel}</td><td>{money(booking.priceCents)}</td><td>{booking.paymentOption === 'full' ? 'Integral' : 'Sinal 50%'}</td><td>{money(booking.paymentAmountCents)}</td><td>{money(Math.max(0, booking.priceCents - booking.paymentAmountCents))}</td></tr>
  ))}</tbody></table></div>;
}

function PendingClients({ bookings, busyPayment, onPaymentAction }: { bookings: Booking[]; busyPayment: string; onPaymentAction: (id: string, action: 'sync' | 'manual-paid') => void }) {
  if (!bookings.length) return <div className="empty-state">Nenhuma cliente aguardando pagamento.</div>;
  return <div className="payment-list">{bookings.map((booking) => (
    <article className="payment-row" key={booking.id}>
      <div><strong>{booking.clientName}</strong><small>{booking.whatsapp}{booking.email ? ` · ${booking.email}` : ''}</small></div>
      <div><strong>{booking.serviceLabel}</strong><small>{formatDate(booking.appointmentDate)} · {booking.appointmentTime}</small></div>
      <div><strong>{booking.paymentAmountCents ? money(booking.paymentAmountCents) : 'Sob consulta'}</strong><small>{booking.paymentOption === 'full' ? 'Pagamento integral' : 'Sinal de 50%'}</small></div>
      <div><span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span><PaymentActions booking={booking} busy={busyPayment === booking.id} onAction={onPaymentAction} /></div>
    </article>
  ))}</div>;
}

function PaymentActions({ booking, busy, onAction }: { booking: Booking; busy: boolean; onAction: (id: string, action: 'sync' | 'manual-paid') => void }) {
  if (booking.paymentAmountCents <= 0) return null;
  return <div className="payment-actions">
    {booking.paymentProvider === 'mercado_pago' && <button type="button" disabled={busy} onClick={() => onAction(booking.id, 'sync')}>{busy ? 'Conferindo...' : 'Sincronizar MP'}</button>}
    <button type="button" className="manual" disabled={busy} onClick={() => onAction(booking.id, 'manual-paid')}>Marcar como pago</button>
  </div>;
}

function groupClients(bookings: Booking[]) {
  const clients = new Map<string, { key: string; name: string; whatsapp: string; email: string; bookings: number; value: number }>();
  for (const booking of bookings) {
    const key = booking.whatsapp.replace(/\D/g, '') || booking.email || booking.clientName;
    const current = clients.get(key) || { key, name: booking.clientName, whatsapp: booking.whatsapp, email: booking.email || '', bookings: 0, value: 0 };
    current.bookings += 1;
    current.value += booking.priceCents;
    clients.set(key, current);
  }
  return [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function sum(items: Booking[], field: 'priceCents' | 'depositCents' | 'paymentAmountCents') { return items.reduce((total, booking) => total + booking[field], 0); }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function formatDate(value: string) { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function iso(value: Date) { return value.toISOString().slice(0, 10); }
function addDays(value: Date, days: number) { const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result; }
function weekday(value: Date) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(value).replace('.', ''); }
function todayInSaoPaulo() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function todayFromTimestamp(timestamp: number) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp)); }
function longDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function paymentLabel(status: string) { return ({ pago: 'Pago', em_analise: 'Em análise', aguardando: 'Aguardando', rejeitado: 'Recusado', cancelado: 'Cancelado', estornado: 'Estornado', nao_aplicavel: 'Sob consulta', configuracao_pendente: 'Pagamento indisponível' } as Record<string, string>)[status] || status.replaceAll('_', ' '); }
