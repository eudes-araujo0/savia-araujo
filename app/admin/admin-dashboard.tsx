'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CircleDollarSign, LayoutDashboard, ReceiptText, Search, Sparkles, Users } from 'lucide-react';
import type { Booking } from '../../db/schema';

type View = 'visao-geral' | 'agenda' | 'clientes' | 'financeiro' | 'comprovantes';

type Props = {
  initialBookings: Booking[];
  username: string;
  signOutPath: string;
};

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { id: 'comprovantes', label: 'Comprovantes', icon: ReceiptText },
];

export default function AdminDashboard({ initialBookings, username, signOutPath }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [view, setView] = useState<View>('visao-geral');
  const [query, setQuery] = useState('');
  const [agendaDate, setAgendaDate] = useState(todayInSaoPaulo());
  const today = useMemo(() => todayInSaoPaulo(), []);

  const activeBookings = useMemo(() => bookings.filter((booking) => booking.status !== 'cancelado'), [bookings]);
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
      const period = activeBookings.filter(range.predicate);
      return { ...range, value: money(sum(period, 'priceCents')), count: period.length };
    });
  }, [activeBookings, today]);

  const financial = useMemo(() => {
    const paid = activeBookings.filter((booking) => booking.paymentStatus === 'pago');
    const received = sum(paid, 'depositCents');
    const contracted = sum(activeBookings, 'priceCents');
    const outstanding = activeBookings.reduce((total, booking) => total + Math.max(0, booking.priceCents - (booking.paymentStatus === 'pago' ? booking.depositCents : 0)), 0);
    const pendingDeposits = activeBookings.filter((booking) => !['pago', 'nao_aplicavel'].includes(booking.paymentStatus)).reduce((total, booking) => total + booking.depositCents, 0);
    return { paid, received, contracted, outstanding, pendingDeposits };
  }, [activeBookings]);

  const agendaBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate === agendaDate), [activeBookings, agendaDate]);
  const todayBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate === today), [activeBookings, today]);
  const clients = useMemo(() => groupClients(activeBookings), [activeBookings]);
  const chart = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(`${today}T12:00:00Z`), index - 6);
    const dateIso = iso(date);
    const value = financial.paid.filter((booking) => booking.paidAt && todayFromTimestamp(booking.paidAt) === dateIso).reduce((total, booking) => total + booking.depositCents, 0);
    return { date: dateIso, label: weekday(date), value };
  }), [financial.paid, today]);
  const maxChart = Math.max(...chart.map((item) => item.value), 1);

  async function changeStatus(id: string, status: string) {
    const before = bookings;
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
    const response = await fetch('/api/bookings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) });
    if (!response.ok) setBookings(before);
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
        <div className="admin-user"><strong>{username}</strong><small>Administradora</small><a href={signOutPath}>Sair do painel</a></div>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div><p>{longDate(today)}</p><h1>{navigation.find((item) => item.id === view)?.label}</h1></div>
          <span className="admin-date">{bookings.length} agendamentos registrados</span>
        </header>

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
            {!clients.length && <div className="empty-state">Os clientes aparecerão aqui após o primeiro agendamento.</div>}
          </section>
          {!!filteredBookings.length && <section className="admin-panel admin-full"><div className="panel-head"><h2>Histórico dos clientes</h2><span>{filteredBookings.length} registros</span></div><BookingsTable bookings={filteredBookings} onStatusChange={changeStatus} /></section>}
        </>}

        {view === 'financeiro' && <>
          <div className="finance-summary">
            <article><small>Contratado</small><strong>{money(financial.contracted)}</strong><span>valor total dos serviços ativos</span></article>
            <article><small>Sinais recebidos</small><strong>{money(financial.received)}</strong><span>50% confirmados pelo pagamento</span></article>
            <article><small>Sinais pendentes</small><strong>{money(financial.pendingDeposits)}</strong><span>reservas ainda não confirmadas</span></article>
            <article><small>Saldo a receber</small><strong>{money(financial.outstanding)}</strong><span>restante após os sinais pagos</span></article>
          </div>
          <section className="admin-panel admin-full">
            <div className="panel-head"><h2>Entradas nos últimos 7 dias</h2><span>sinais aprovados</span></div>
            <div className="revenue-chart tall-chart" aria-label="Entradas dos últimos sete dias">
              {chart.map((item) => <div className="chart-bar" key={item.date}><strong>{item.value ? money(item.value) : ''}</strong><i style={{ height: `${Math.max(5, item.value / maxChart * 100)}%` }} /><span>{item.label}</span></div>)}
            </div>
          </section>
          <section className="admin-panel admin-full"><div className="panel-head"><h2>Movimentação por reserva</h2><span>{activeBookings.length} reservas ativas</span></div><FinanceTable bookings={activeBookings} /></section>
        </>}

        {view === 'comprovantes' && <section className="admin-panel admin-view-panel">
          <div className="panel-head"><div><h2>Pagamentos e comprovantes</h2><span>A confirmação ocorre somente após 50% do valor aprovado</span></div></div>
          <div className="payment-list">
            {bookings.map((booking) => (
              <article className="payment-row" key={booking.id}>
                <div><strong>{booking.clientName}</strong><small>{booking.id} · {booking.serviceLabel}</small></div>
                <div><small>Sinal</small><strong>{booking.depositCents ? money(booking.depositCents) : 'Sob consulta'}</strong></div>
                <span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span>
                <div className="payment-proof">
                  {booking.paymentId && <small>{booking.paymentProvider === 'demo' ? 'Demonstração' : 'Mercado Pago'} · {booking.paymentId}</small>}
                  {booking.receiptKey && <a className="receipt-link" href={`/api/receipts/${booking.id}`} target="_blank">Abrir comprovante enviado</a>}
                  {!booking.paymentId && !booking.receiptKey && <small>Aguardando pagamento</small>}
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
  return <div className="bookings-table-wrap"><table className="bookings-table"><thead><tr><th>Cliente</th><th>Serviço</th><th>Total</th><th>Sinal 50%</th><th>Recebido</th><th>Saldo</th></tr></thead><tbody>{bookings.map((booking) => (
    <tr key={booking.id}><td>{booking.clientName}</td><td>{booking.serviceLabel}</td><td>{money(booking.priceCents)}</td><td>{money(booking.depositCents)}</td><td>{booking.paymentStatus === 'pago' ? money(booking.depositCents) : money(0)}</td><td>{money(Math.max(0, booking.priceCents - (booking.paymentStatus === 'pago' ? booking.depositCents : 0)))}</td></tr>
  ))}</tbody></table></div>;
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

function sum(items: Booking[], field: 'priceCents' | 'depositCents') { return items.reduce((total, booking) => total + booking[field], 0); }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function formatDate(value: string) { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function iso(value: Date) { return value.toISOString().slice(0, 10); }
function addDays(value: Date, days: number) { const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result; }
function weekday(value: Date) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(value).replace('.', ''); }
function todayInSaoPaulo() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function todayFromTimestamp(timestamp: number) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp)); }
function longDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function paymentLabel(status: string) { return ({ pago: 'Sinal pago', em_analise: 'Em análise', aguardando: 'Aguardando', rejeitado: 'Recusado', cancelado: 'Cancelado', estornado: 'Estornado', nao_aplicavel: 'Sob consulta', configuracao_pendente: 'Pagamento indisponível' } as Record<string, string>)[status] || status.replaceAll('_', ' '); }
