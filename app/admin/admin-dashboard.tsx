'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, Clock3, CreditCard, LayoutDashboard, MessageCircle, ReceiptText,
  RefreshCw, Search, Sparkles, Users, X, Plus, Ban, Trash2, Download, Pencil, Images,
} from 'lucide-react';
import type { Booking, Expense, ScheduleBlock } from '../../db/schema';
import { BOOKING_TIMES, SERVICE_CATALOG } from '../../lib/service-catalog';
import { useSiteMedia } from '../../lib/use-site-media';
import { managedMediaStyle } from '../../lib/site-media';
import MediaManager from './media-manager';

type View = 'visao-geral' | 'agenda' | 'clientes' | 'clientes-pendentes' | 'financeiro' | 'comprovantes' | 'imagens';
type PaymentAction = 'sync' | 'manual-paid';
type AdminModal = '' | 'booking' | 'block' | 'expense' | 'edit';

type Props = { initialBookings: Booking[]; initialExpenses: Expense[]; initialBlocks: ScheduleBlock[]; username: string; signOutPath: string };

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'clientes-pendentes', label: 'Pendências', icon: Clock3 },
  { id: 'financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { id: 'comprovantes', label: 'Pagamentos', icon: ReceiptText },
  { id: 'imagens', label: 'Imagens do site', icon: Images },
];

export default function AdminDashboard({ initialBookings, initialExpenses, initialBlocks, username, signOutPath }: Props) {
  const getMedia = useSiteMedia();
  const [bookings, setBookings] = useState(initialBookings);
  const [view, setView] = useState<View>('visao-geral');
  const [query, setQuery] = useState('');
  const [agendaDate, setAgendaDate] = useState(todayInSaoPaulo());
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyPayment, setBusyPayment] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [blocks, setBlocks] = useState<ScheduleBlock[]>(initialBlocks);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [modal, setModal] = useState<AdminModal>('');
  const [operationBusy, setOperationBusy] = useState(false);
  const today = useMemo(() => todayInSaoPaulo(), []);

  const refreshBookings = useCallback(async (successMessage = '') => {
    setRefreshing(true);
    try {
      const [bookingResponse, operationResponse] = await Promise.all([
        fetch('/api/bookings', { cache: 'no-store' }),
        fetch('/api/admin/operations', { cache: 'no-store' }),
      ]);
      const result = await bookingResponse.json() as { bookings?: Booking[]; error?: string };
      const operations = await operationResponse.json() as { blocks?: ScheduleBlock[]; expenses?: Expense[]; error?: string };
      if (!bookingResponse.ok) throw new Error(result.error || 'Não foi possível atualizar o painel.');
      if (!operationResponse.ok) throw new Error(operations.error || 'Não foi possível carregar agenda e despesas.');
      setBookings(result.bookings || []);
      setBlocks(operations.blocks || []);
      setExpenses(operations.expenses || []);
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

  useEffect(() => {
    if (!selectedBookingId) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedBookingId(''); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedBookingId]);

  const activeBookings = useMemo(() => bookings.filter((booking) => !['cancelado', 'expirado'].includes(booking.status)), [bookings]);
  const paidBookings = useMemo(() => activeBookings.filter((booking) => booking.paymentStatus === 'pago'), [activeBookings]);
  const pendingBookings = useMemo(() => activeBookings.filter((booking) => booking.paymentStatus !== 'pago'), [activeBookings]);
  const selectedBooking = useMemo(() => bookings.find((booking) => booking.id === selectedBookingId) || null, [bookings, selectedBookingId]);
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
      { label: 'Recebido hoje', predicate: (booking: Booking) => Boolean(booking.paidAt && todayFromTimestamp(booking.paidAt) === today), note: 'entradas aprovadas' },
      { label: 'Esta semana', predicate: (booking: Booking) => booking.appointmentDate >= iso(monday) && booking.appointmentDate <= iso(sunday), note: `${formatDate(iso(monday)).slice(0, 5)} a ${formatDate(iso(sunday)).slice(0, 5)}` },
      { label: 'Este mês', predicate: (booking: Booking) => booking.appointmentDate.startsWith(today.slice(0, 7)), note: 'valor recebido' },
      { label: 'No ano', predicate: (booking: Booking) => booking.appointmentDate.startsWith(today.slice(0, 4)), note: 'valor recebido' },
    ];
    return ranges.map((range) => {
      const period = paidBookings.filter(range.predicate);
      return { ...range, value: money(sum(period, 'paymentAmountCents')), count: period.length };
    });
  }, [paidBookings, today]);

  const financial = useMemo(() => {
    const received = paidBookings.reduce((total, booking) => total + receivedCents(booking), 0);
    const contracted = sum(paidBookings, 'priceCents');
    const fullReceived = paidBookings.filter((booking) => booking.paymentOption === 'full').reduce((total, booking) => total + booking.paymentAmountCents, 0);
    const outstanding = paidBookings.reduce((total, booking) => total + Math.max(0, booking.priceCents - receivedCents(booking)), 0);
    const spent = expenses.reduce((total, expense) => total + expense.amountCents, 0);
    return { paid: paidBookings, received, contracted, fullReceived, outstanding, spent, profit: received - spent };
  }, [paidBookings, expenses]);

  const agendaBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate === agendaDate).sort(byTime), [activeBookings, agendaDate]);
  const todayBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate === today).sort(byTime), [activeBookings, today]);
  const upcomingBookings = useMemo(() => activeBookings.filter((booking) => booking.appointmentDate >= today && booking.appointmentDate <= iso(addDays(new Date(`${today}T12:00:00Z`), 7))).sort(byAppointment), [activeBookings, today]);
  const nextBooking = upcomingBookings[0];
  const clients = useMemo(() => groupClients(paidBookings), [paidBookings]);
  const pendingValue = useMemo(() => pendingBookings.reduce((total, booking) => total + booking.paymentAmountCents, 0), [pendingBookings]);
  const chart = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(`${today}T12:00:00Z`), index - 6);
    const dateIso = iso(date);
    const value = financial.paid.filter((booking) => booking.paidAt && todayFromTimestamp(booking.paidAt) === dateIso).reduce((total, booking) => total + booking.paymentAmountCents, 0);
    return { date: dateIso, label: weekday(date), value };
  }), [financial.paid, today]);
  const maxChart = Math.max(...chart.map((item) => item.value), 1);
  const dayGroups = useMemo(() => groupByAppointmentDay(activeBookings, expenses), [activeBookings, expenses]);
  const selectedDay = useMemo(() => dayGroups.find((day) => day.date === agendaDate), [dayGroups, agendaDate]);
  const selectedBlocks = useMemo(() => blocks.filter((block) => block.blockDate === agendaDate), [blocks, agendaDate]);

  async function changeStatus(id: string, status: string) {
    const before = bookings;
    setFeedback(null);
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
    try {
      const response = await fetch('/api/bookings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível alterar o status.');
      await refreshBookings('Status do atendimento atualizado.');
    } catch (error) {
      setBookings(before);
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível alterar o status.' });
    }
  }

  async function changePayment(id: string, action: PaymentAction) {
    if (action === 'manual-paid' && !window.confirm('Confirmar manualmente que este pagamento foi recebido?')) return;
    setBusyPayment(id);
    setFeedback(null);
    try {
      const response = await fetch('/api/payments/reconcile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookingId: id, action }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível conferir o pagamento.');
      await refreshBookings(action === 'manual-paid' ? 'Pagamento confirmado manualmente.' : 'Pagamento conferido no provedor.');
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível conferir o pagamento.' });
    } finally {
      setBusyPayment('');
    }
  }

  function openAgenda(date = today) { setAgendaDate(date); setView('agenda'); }
  function shiftAgenda(days: number) { setAgendaDate((current) => iso(addDays(new Date(`${current}T12:00:00Z`), days))); }

  async function submitOperation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get('action') || '');
    const payload: Record<string, unknown> = { action };
    form.forEach((value, key) => { if (key !== 'action') payload[key] = value; });
    if ('fullDay' in payload) payload.fullDay = payload.fullDay === 'on';
    if ('paid' in payload) payload.paid = payload.paid === 'on';
    if ('amount' in payload) { payload.amountCents = Math.round(Number(String(payload.amount).replace(',', '.')) * 100); delete payload.amount; }
    setOperationBusy(true); setFeedback(null);
    try {
      const method = action === 'update-booking' ? 'PATCH' : 'POST';
      const response = await fetch('/api/admin/operations', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      setModal(''); setSelectedBookingId('');
      await refreshBookings(action === 'create-expense' ? 'Despesa registrada.' : action === 'create-block' ? 'Agenda bloqueada.' : action === 'update-booking' ? 'Atendimento atualizado.' : 'Atendimento criado.');
    } catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível salvar.' }); }
    finally { setOperationBusy(false); }
  }

  async function deleteOperation(type: 'block' | 'expense', id: string) {
    if (!window.confirm(type === 'block' ? 'Remover este bloqueio da agenda?' : 'Excluir esta despesa?')) return;
    const response = await fetch(`/api/admin/operations?type=${type}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setFeedback({ kind: 'error', message: result.error || 'Não foi possível excluir.' }); return; }
    await refreshBookings(type === 'block' ? 'Bloqueio removido.' : 'Despesa excluída.');
  }

  async function receiveBalance(id: string, amountCents: number) {
    const response = await fetch('/api/admin/operations', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'receive-balance', id, amountCents }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || 'Não foi possível registrar o saldo.');
    await refreshBookings('Saldo recebido e financeiro atualizado.');
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link>
        <p className="admin-nav-label">Gestão do estúdio</p>
        <nav className="admin-nav" aria-label="Painel administrativo">
          {navigation.map(({ id, label, icon: Icon }) => {
            const badge = id === 'clientes-pendentes' ? pendingBookings.length : id === 'agenda' ? todayBookings.length : 0;
            return <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={15} /><span>{label}</span>{badge > 0 && <b>{badge}</b>}</button>;
          })}
        </nav>
        <div className="admin-owner-card"><Image className="managed-media" src={getMedia('admin.profile').url} alt={getMedia('admin.profile').alt} fill sizes="240px" style={managedMediaStyle(getMedia('admin.profile'))} /><div><strong>Sávia Araújo</strong><small>Makeup Artist</small></div></div>
        <div className="admin-user"><strong>{username}</strong><small>Acesso master</small><a href={signOutPath}>Sair do painel</a></div>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div><p>{longDate(today)}</p><h1>{navigation.find((item) => item.id === view)?.label}</h1></div>
          <div className="admin-header-actions"><button className="admin-create" onClick={() => setModal('booking')}><Plus size={14} /> Novo atendimento</button><span className="admin-date"><i /> Atualização automática</span><button className="admin-refresh" onClick={() => void refreshBookings('Painel atualizado.')} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'spinning' : ''} /> Atualizar</button></div>
        </header>
        {feedback && <p className={`admin-feedback ${feedback.kind}`}>{feedback.message}</p>}

        {view === 'visao-geral' && <>
          <section className="admin-command">
            <div><p className="eyebrow">Seu estúdio, em um olhar</p><h2>O que precisa da sua<br /><em>atenção hoje.</em></h2></div>
            <div className="admin-next"><small>Próximo atendimento</small>{nextBooking ? <><strong>{nextBooking.clientName}</strong><span>{formatDate(nextBooking.appointmentDate)} · {nextBooking.appointmentTime}<br />{nextBooking.serviceLabel}</span><button onClick={() => setSelectedBookingId(nextBooking.id)}>Abrir detalhes <ArrowRight size={13} /></button></> : <p>Agenda livre nos próximos sete dias.</p>}</div>
          </section>
          {!bookings.length && <p className="admin-demo-banner">O painel está conectado ao banco. Faça um agendamento pelo site para ver o fluxo completo aparecer aqui.</p>}
          <div className="admin-priority-grid" aria-label="Atalhos de prioridade">
            <button className={pendingBookings.length ? 'attention' : ''} onClick={() => setView('clientes-pendentes')}><AlertCircle size={18} /><span><small>Aguardando pagamento</small><strong>{pendingBookings.length}</strong><em>{pendingBookings.length ? `${money(pendingValue)} a confirmar` : 'Tudo em dia'}</em></span><ArrowRight size={15} /></button>
            <button onClick={() => openAgenda()}><CalendarDays size={18} /><span><small>Agenda de hoje</small><strong>{todayBookings.length}</strong><em>{todayBookings.length === 1 ? 'atendimento' : 'atendimentos'}</em></span><ArrowRight size={15} /></button>
            <button onClick={() => openAgenda(nextBooking?.appointmentDate)}><Clock3 size={18} /><span><small>Próximos 7 dias</small><strong>{upcomingBookings.length}</strong><em>compromissos ativos</em></span><ArrowRight size={15} /></button>
            <button onClick={() => setView('financeiro')}><CircleDollarSign size={18} /><span><small>Recebido</small><strong>{money(financial.received)}</strong><em>pagamentos aprovados</em></span><ArrowRight size={15} /></button>
          </div>
          <div className="stat-grid">{periodStats.map(({ label, value, note, count }, index) => { const Icon = [CircleDollarSign, CalendarDays, Users, Sparkles][index]; return <article className="stat-card" key={label}><div className="stat-card-head"><span>{label}</span><Icon size={15} /></div><strong>{value}</strong><small>{count} {count === 1 ? 'reserva' : 'reservas'} · {note}</small></article>; })}</div>
          <div className="admin-grid">
            <section className="admin-panel"><div className="panel-head"><div><h2>Agenda de hoje</h2><span>{todayBookings.length ? 'Organizada por horário' : 'Nenhum compromisso'}</span></div><button onClick={() => openAgenda()}>Ver agenda</button></div><AppointmentList bookings={todayBookings} onStatusChange={changeStatus} onOpen={setSelectedBookingId} /></section>
            <section className="admin-panel"><div className="panel-head"><div><h2>Pendências recentes</h2><span>Precisam de confirmação</span></div><button onClick={() => setView('clientes-pendentes')}>Ver todas</button></div><PendingClients bookings={pendingBookings.slice(0, 3)} busyPayment={busyPayment} onPaymentAction={changePayment} onOpen={setSelectedBookingId} compact /></section>
          </div>
          <section className="admin-panel admin-full"><div className="panel-head"><div><h2>Reservas recentes</h2><span>Últimas movimentações do site</span></div><span>{bookings.length} registros</span></div><BookingsTable bookings={bookings.slice(0, 8)} onStatusChange={changeStatus} onOpen={setSelectedBookingId} /></section>
        </>}

        {view === 'agenda' && <>
          <section className="agenda-toolbar"><div className="agenda-day-navigation"><button aria-label="Dia anterior" onClick={() => shiftAgenda(-1)}><ChevronLeft size={17} /></button><button onClick={() => setAgendaDate(today)}>Hoje</button><button aria-label="Próximo dia" onClick={() => shiftAgenda(1)}><ChevronRight size={17} /></button></div><div><small>Data selecionada</small><strong>{longDate(agendaDate)}</strong></div><input aria-label="Escolher data da agenda" type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} /></section>
          <div className="admin-view-actions"><button onClick={() => setModal('booking')}><Plus size={14} /> Novo atendimento</button><button onClick={() => setModal('block')}><Ban size={14} /> Bloquear horário ou dia</button></div>
          <div className="agenda-summary"><div><small>Atendimentos</small><strong>{agendaBookings.length}</strong></div><div><small>Confirmados</small><strong>{agendaBookings.filter((booking) => booking.paymentStatus === 'pago').length}</strong></div><div><small>Recebido neste dia</small><strong>{money(selectedDay?.received || 0)}</strong></div><div><small>A receber neste dia</small><strong>{money(selectedDay?.outstanding || 0)}</strong></div></div>
          {!!selectedBlocks.length && <section className="day-blocks"><div><Ban size={15} /><strong>Bloqueios de {formatDate(agendaDate)}</strong></div>{selectedBlocks.map((block) => <article key={block.id}><span>{block.startTime && block.endTime ? `${block.startTime}–${block.endTime}` : 'Dia inteiro'} · {block.reason}</span><button aria-label="Remover bloqueio" onClick={() => void deleteOperation('block', block.id)}><Trash2 size={13} /></button></article>)}</section>}
          <section className="admin-panel admin-view-panel"><div className="panel-head"><div><h2>Linha do dia</h2><span>Horários, clientes e situação da reserva</span></div><strong>{agendaBookings.length}</strong></div><AppointmentList bookings={agendaBookings} onStatusChange={changeStatus} onOpen={setSelectedBookingId} showPayment /></section>
          <section className="admin-panel admin-full day-overview"><div className="panel-head"><div><h2>Agenda e valores por dia</h2><span>Cada data com seus próprios atendimentos e totais</span></div></div><DayTable groups={dayGroups.filter((day) => day.date >= today).slice(0, 45)} onOpenDay={openAgenda} /></section>
        </>}

        {view === 'clientes' && <>
          <div className="admin-search"><Search size={15} /><input aria-label="Buscar clientes" placeholder="Buscar por nome, WhatsApp, e-mail ou serviço" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <section className="client-grid">{clients.filter((client) => !query || [client.name, client.whatsapp, client.email].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map((client) => <article className="client-card" key={client.key}><span>{initials(client.name)}</span><div><h2>{client.name}</h2><p>{client.whatsapp}{client.email ? ` · ${client.email}` : ''}</p><small>{client.bookings} {client.bookings === 1 ? 'atendimento' : 'atendimentos'} · {money(client.value)} contratados</small><div className="client-actions"><a href={whatsappUrl(client.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={12} /> WhatsApp</a><button onClick={() => setSelectedBookingId(client.lastBookingId)}>Histórico <ArrowRight size={12} /></button></div></div></article>)}{!clients.length && <div className="empty-state">Os clientes aparecerão aqui após o pagamento ser aprovado.</div>}</section>
          {!!filteredBookings.length && <section className="admin-panel admin-full"><div className="panel-head"><div><h2>Histórico das clientes</h2><span>Reservas e atendimentos</span></div><span>{filteredBookings.length} registros</span></div><BookingsTable bookings={filteredBookings} onStatusChange={changeStatus} onOpen={setSelectedBookingId} /></section>}
        </>}

        {view === 'clientes-pendentes' && <><section className="pending-hero"><div><p className="eyebrow">Central de confirmação</p><h2>{pendingBookings.length ? `${pendingBookings.length} ${pendingBookings.length === 1 ? 'reserva precisa' : 'reservas precisam'} de atenção.` : 'Tudo confirmado por aqui.'}</h2><span>Confira a InfinitePay, fale com a cliente ou confirme manualmente somente quando o valor estiver em conta.</span></div><div><small>Valor aguardado</small><strong>{money(pendingValue)}</strong></div></section><section className="admin-panel admin-view-panel"><div className="panel-head"><div><h2>Fila de pendências</h2><span>Mais recentes primeiro</span></div><strong>{pendingBookings.length}</strong></div><PendingClients bookings={pendingBookings} busyPayment={busyPayment} onPaymentAction={changePayment} onOpen={setSelectedBookingId} /></section></>}

        {view === 'financeiro' && <><div className="admin-view-actions"><button onClick={() => setModal('expense')}><Plus size={14} /> Registrar despesa</button><a href="/api/admin/export?type=financeiro"><Download size={14} /> Exportar CSV</a></div><div className="finance-summary"><article><small>Recebido</small><strong>{money(financial.received)}</strong><span>sinais, integrais e saldos</span></article><article><small>Despesas</small><strong>{money(financial.spent)}</strong><span>custos registrados</span></article><article><small>Resultado</small><strong>{money(financial.profit)}</strong><span>recebido menos despesas</span></article><article><small>Saldo a receber</small><strong>{money(financial.outstanding)}</strong><span>restante dos atendimentos confirmados</span></article></div><section className="admin-panel admin-full"><div className="panel-head"><div><h2>Entradas nos últimos 7 dias</h2><span>Pagamentos aprovados</span></div></div><div className="revenue-chart tall-chart" aria-label="Entradas dos últimos sete dias">{chart.map((item) => <div className="chart-bar" key={item.date}><strong>{item.value ? money(item.value) : ''}</strong><i style={{ height: `${Math.max(5, item.value / maxChart * 100)}%` }} /><span>{item.label}</span></div>)}</div></section><section className="admin-panel admin-full"><div className="panel-head"><div><h2>Caixa por data do atendimento</h2><span>Receita, saldo, despesas e resultado separados por dia</span></div></div><DayTable groups={dayGroups} onOpenDay={openAgenda} financial /></section><section className="admin-panel admin-full"><div className="panel-head"><div><h2>Despesas</h2><span>Custos lançados por data</span></div><strong>{expenses.length}</strong></div><ExpenseList expenses={expenses} onDelete={(id) => void deleteOperation('expense', id)} /></section><section className="admin-panel admin-full"><div className="panel-head"><div><h2>Movimentação por reserva</h2><span>Sinal, integral e saldo</span></div><span>{paidBookings.length} aprovados</span></div><FinanceTable bookings={paidBookings} onOpen={setSelectedBookingId} /></section></>}

        {view === 'comprovantes' && <section className="admin-panel admin-view-panel"><div className="panel-head"><div><h2>Pagamentos e comprovantes</h2><span>Confirmações do checkout e registros manuais</span></div><span>{bookings.length} registros</span></div><div className="payment-list proof-list">{bookings.map((booking) => <article className="payment-row" key={booking.id}><div><strong>{booking.clientName}</strong><small>{booking.id} · {booking.serviceLabel}</small></div><div><small>{booking.paymentOption === 'full' ? 'Integral' : 'Sinal 50%'}</small><strong>{booking.paymentAmountCents ? money(booking.paymentAmountCents) : 'Sob consulta'}</strong></div><span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span><div className="payment-proof">{booking.paymentId && <small>{paymentProviderLabel(booking.paymentProvider)} · {booking.paymentId}</small>}{booking.paymentReceiptUrl && <a className="receipt-link" href={booking.paymentReceiptUrl} target="_blank" rel="noreferrer">Comprovante InfinitePay</a>}{booking.receiptKey && <a className="receipt-link" href={`/api/receipts/${booking.id}`} target="_blank">Abrir comprovante</a>}{!booking.paymentId && !booking.receiptKey && <small>Aguardando pagamento</small>}<button className="details-link" onClick={() => setSelectedBookingId(booking.id)}>Ver reserva <ArrowRight size={11} /></button>{booking.paymentStatus !== 'pago' && <PaymentActions booking={booking} busy={busyPayment === booking.id} onAction={changePayment} />}</div></article>)}{!bookings.length && <div className="empty-state">Nenhum pagamento registrado.</div>}</div></section>}

        {view === 'imagens' && <MediaManager />}
      </section>
      {selectedBooking && <BookingDrawer booking={selectedBooking} busyPayment={busyPayment === selectedBooking.id} onClose={() => setSelectedBookingId('')} onStatusChange={changeStatus} onPaymentAction={changePayment} onEdit={() => setModal('edit')} onReceiveBalance={receiveBalance} />}
      {modal && <OperationModal mode={modal} agendaDate={agendaDate} booking={modal === 'edit' ? selectedBooking : null} busy={operationBusy} onClose={() => setModal('')} onSubmit={submitOperation} />}
    </main>
  );
}

function AppointmentList({ bookings, onStatusChange, onOpen, showPayment = false }: { bookings: Booking[]; onStatusChange: (id: string, status: string) => void; onOpen: (id: string) => void; showPayment?: boolean }) {
  if (!bookings.length) return <div className="empty-state"><CalendarDays size={22} /><strong>Agenda livre</strong><span>Nenhum atendimento nesta data.</span></div>;
  return <div className="appointment-list">{bookings.map((booking) => <div className="appointment-row" key={booking.id}><span className="appointment-time">{booking.appointmentTime}</span><div className="appointment-client"><strong>{booking.clientName}</strong><small>{booking.serviceLabel} · {booking.whatsapp}</small>{showPayment && <span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span>}</div><select aria-label={`Status de ${booking.clientName}`} value={booking.status} onChange={(event) => onStatusChange(booking.id, event.target.value)}><option value="pendente">Pendente</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option></select><div className="row-actions"><a aria-label={`Falar com ${booking.clientName} no WhatsApp`} href={whatsappUrl(booking.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14} /></a><button aria-label={`Ver detalhes de ${booking.clientName}`} onClick={() => onOpen(booking.id)}><ArrowRight size={14} /></button></div></div>)}</div>;
}

function BookingsTable({ bookings, onStatusChange, onOpen }: { bookings: Booking[]; onStatusChange: (id: string, status: string) => void; onOpen: (id: string) => void }) {
  if (!bookings.length) return <div className="empty-state">Nenhum agendamento registrado.</div>;
  return <div className="bookings-table-wrap"><table className="bookings-table"><thead><tr><th>Cliente</th><th>Data</th><th>Serviço</th><th>Valor</th><th>Pagamento</th><th>Status</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td>{booking.clientName}<br /><small>{booking.whatsapp}</small></td><td>{formatDate(booking.appointmentDate)} · {booking.appointmentTime}</td><td>{booking.serviceLabel}</td><td>{booking.priceCents ? money(booking.priceCents) : 'A definir'}</td><td><span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span></td><td><select aria-label={`Status de ${booking.clientName}`} value={booking.status} onChange={(event) => onStatusChange(booking.id, event.target.value)}><option value="pendente">Pendente</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option><option value="expirado">Expirado</option></select></td><td><button className="table-open" onClick={() => onOpen(booking.id)}>Detalhes <ArrowRight size={11} /></button></td></tr>)}</tbody></table></div>;
}

function FinanceTable({ bookings, onOpen }: { bookings: Booking[]; onOpen: (id: string) => void }) {
  if (!bookings.length) return <div className="empty-state">Nenhuma movimentação financeira.</div>;
  return <div className="bookings-table-wrap"><table className="bookings-table"><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Total</th><th>Opção</th><th>Recebido</th><th>Saldo</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td>{formatDate(booking.appointmentDate)}</td><td>{booking.clientName}</td><td>{booking.serviceLabel}</td><td>{money(booking.priceCents)}</td><td>{booking.paymentOption === 'full' ? 'Integral' : 'Sinal 50%'}</td><td>{money(receivedCents(booking))}</td><td>{money(Math.max(0, booking.priceCents - receivedCents(booking)))}</td><td><button className="table-open" onClick={() => onOpen(booking.id)}>Detalhes <ArrowRight size={11} /></button></td></tr>)}</tbody></table></div>;
}

function PendingClients({ bookings, busyPayment, onPaymentAction, onOpen, compact = false }: { bookings: Booking[]; busyPayment: string; onPaymentAction: (id: string, action: PaymentAction) => void; onOpen: (id: string) => void; compact?: boolean }) {
  if (!bookings.length) return <div className="empty-state"><CheckCircle2 size={22} /><strong>Nenhuma pendência</strong><span>Todos os pagamentos estão confirmados.</span></div>;
  return <div className={`pending-list ${compact ? 'compact' : ''}`}>{bookings.map((booking) => <article className="pending-card" key={booking.id}><div className="pending-card-main"><span className="pending-avatar">{initials(booking.clientName)}</span><div><strong>{booking.clientName}</strong><small>{booking.serviceLabel} · {formatDate(booking.appointmentDate)} às {booking.appointmentTime}</small></div></div>{!compact && <div className="pending-amount"><small>{booking.paymentOption === 'full' ? 'Integral' : 'Sinal de 50%'}</small><strong>{booking.paymentAmountCents ? money(booking.paymentAmountCents) : 'Sob consulta'}</strong></div>}<div className="pending-state"><span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span><small>{paymentGuidance(booking.paymentStatus)}</small></div><div className="pending-actions"><a href={whatsappUrl(booking.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={12} /> WhatsApp</a><button onClick={() => onOpen(booking.id)}>Detalhes</button>{!compact && <PaymentActions booking={booking} busy={busyPayment === booking.id} onAction={onPaymentAction} />}</div></article>)}</div>;
}

function PaymentActions({ booking, busy, onAction }: { booking: Booking; busy: boolean; onAction: (id: string, action: PaymentAction) => void }) {
  if (booking.paymentAmountCents <= 0) return null;
  return <div className="payment-actions">{booking.paymentProvider === 'mercado_pago' && <button type="button" disabled={busy} onClick={() => onAction(booking.id, 'sync')}>{busy ? 'Conferindo...' : 'Sincronizar MP'}</button>}<button type="button" className="manual" disabled={busy} onClick={() => onAction(booking.id, 'manual-paid')}>Marcar como pago</button></div>;
}

function BookingDrawer({ booking, busyPayment, onClose, onStatusChange, onPaymentAction, onEdit, onReceiveBalance }: { booking: Booking; busyPayment: boolean; onClose: () => void; onStatusChange: (id: string, status: string) => void; onPaymentAction: (id: string, action: PaymentAction) => void; onEdit: () => void; onReceiveBalance: (id: string, amountCents: number) => Promise<void> }) {
  const [balanceValue, setBalanceValue] = useState('');
  const [balanceBusy, setBalanceBusy] = useState(false);
  const balance = Math.max(0, booking.priceCents - receivedCents(booking));
  async function saveBalance() {
    const cents = Math.round(Number(balanceValue.replace(',', '.')) * 100);
    if (!Number.isInteger(cents) || cents <= 0 || cents > balance) return;
    setBalanceBusy(true);
    try { await onReceiveBalance(booking.id, cents); setBalanceValue(''); } catch (error) { window.alert(error instanceof Error ? error.message : 'Não foi possível registrar.'); }
    finally { setBalanceBusy(false); }
  }
  return <div className="admin-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title"><header><div><p className="eyebrow">Detalhes da reserva</p><h2 id="booking-drawer-title">{booking.clientName}</h2></div><button aria-label="Fechar detalhes" onClick={onClose}><X size={18} /></button></header><div className="drawer-status"><span className={`payment-pill ${booking.paymentStatus}`}>{paymentLabel(booking.paymentStatus)}</span><select aria-label="Status do atendimento" value={booking.status} onChange={(event) => onStatusChange(booking.id, event.target.value)}><option value="pendente">Pendente</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option><option value="expirado">Expirado</option></select></div><div className="drawer-top-actions"><a className="drawer-whatsapp" href={whatsappUrl(booking.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Conversar com a cliente</a><button onClick={onEdit}><Pencil size={14} /> Editar atendimento</button></div><section className="drawer-section"><h3>Atendimento</h3><dl><div><dt>Experiência</dt><dd>{booking.serviceLabel}</dd></div><div><dt>Data</dt><dd>{longDate(booking.appointmentDate)}</dd></div><div><dt>Horário</dt><dd>{booking.appointmentTime}</dd></div><div><dt>Duração</dt><dd>{booking.durationMinutes} min</dd></div><div><dt>Solicitação</dt><dd>{booking.id}</dd></div></dl></section><section className="drawer-section"><h3>Contato</h3><dl><div><dt>WhatsApp</dt><dd>{booking.whatsapp}</dd></div><div><dt>E-mail</dt><dd>{booking.email || 'Não informado'}</dd></div></dl></section><section className="drawer-section"><h3>Pagamento</h3><div className="drawer-finance"><div><small>Total</small><strong>{booking.priceCents ? money(booking.priceCents) : 'Sob consulta'}</strong></div><div><small>Recebido</small><strong>{money(receivedCents(booking))}</strong></div><div><small>Saldo</small><strong>{money(balance)}</strong></div></div>{booking.paymentStatus !== 'pago' && <PaymentActions booking={booking} busy={busyPayment} onAction={onPaymentAction} />}{booking.paymentReceiptUrl && <a className="receipt-link" href={booking.paymentReceiptUrl} target="_blank" rel="noreferrer"><ReceiptText size={13} /> Abrir comprovante InfinitePay</a>}{booking.receiptKey && <a className="receipt-link" href={`/api/receipts/${booking.id}`} target="_blank"><ReceiptText size={13} /> Abrir comprovante enviado</a>}{booking.paymentStatus === 'pago' && balance > 0 && <div className="balance-form"><label>Registrar saldo recebido<input inputMode="decimal" placeholder={money(balance)} value={balanceValue} onChange={(event) => setBalanceValue(event.target.value)} /></label><button disabled={balanceBusy || !balanceValue} onClick={() => void saveBalance()}>{balanceBusy ? 'Salvando...' : 'Registrar'}</button></div>}</section>{booking.notes && <section className="drawer-section"><h3>Observações da cliente</h3><p>{booking.notes}</p></section>}<footer><CreditCard size={14} /><span>{paymentProviderLabel(booking.paymentProvider)}{booking.paymentId ? ` · ${booking.paymentId}` : ''}</span></footer></aside></div>;
}

type DayGroup = { date: string; bookings: Booking[]; contracted: number; received: number; outstanding: number; expenses: number; result: number };

function DayTable({ groups, onOpenDay, financial = false }: { groups: DayGroup[]; onOpenDay: (date: string) => void; financial?: boolean }) {
  if (!groups.length) return <div className="empty-state">Nenhuma movimentação por dia.</div>;
  return <div className="bookings-table-wrap"><table className="bookings-table day-table"><thead><tr><th>Dia</th><th>Agendamentos</th><th>Contratado</th><th>Recebido</th><th>A receber</th>{financial && <th>Despesas</th>}{financial && <th>Resultado</th>}<th /></tr></thead><tbody>{groups.map((day) => <tr key={day.date}><td><strong>{formatDate(day.date)}</strong><br /><small>{weekdayName(day.date)}</small></td><td>{day.bookings.length}</td><td>{money(day.contracted)}</td><td className="positive-value">{money(day.received)}</td><td>{money(day.outstanding)}</td>{financial && <td className="negative-value">{money(day.expenses)}</td>}{financial && <td>{money(day.result)}</td>}<td><button className="table-open" onClick={() => onOpenDay(day.date)}>Abrir dia <ArrowRight size={11} /></button></td></tr>)}</tbody></table></div>;
}

function ExpenseList({ expenses, onDelete }: { expenses: Expense[]; onDelete: (id: string) => void }) {
  if (!expenses.length) return <div className="empty-state">Nenhuma despesa registrada.</div>;
  return <div className="expense-list">{expenses.map((expense) => <article key={expense.id}><div><strong>{expense.description}</strong><small>{formatDate(expense.expenseDate)} · {expense.category}</small></div><b>{money(expense.amountCents)}</b><button aria-label={`Excluir ${expense.description}`} onClick={() => onDelete(expense.id)}><Trash2 size={13} /></button></article>)}</div>;
}

function OperationModal({ mode, agendaDate, booking, busy, onClose, onSubmit }: { mode: AdminModal; agendaDate: string; booking: Booking | null; busy: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [fullDay, setFullDay] = useState(true);
  const isBooking = mode === 'booking' || mode === 'edit';
  const title = mode === 'booking' ? 'Novo atendimento' : mode === 'edit' ? 'Editar atendimento' : mode === 'block' ? 'Bloquear agenda' : 'Registrar despesa';
  return <div className="operation-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="operation-modal" role="dialog" aria-modal="true" aria-labelledby="operation-title"><header><div><p className="eyebrow">Gestão do estúdio</p><h2 id="operation-title">{title}</h2></div><button aria-label="Fechar" onClick={onClose}><X size={18} /></button></header><form onSubmit={onSubmit}><input type="hidden" name="action" value={mode === 'booking' ? 'create-booking' : mode === 'edit' ? 'update-booking' : mode === 'block' ? 'create-block' : 'create-expense'} />{mode === 'edit' && <input type="hidden" name="id" value={booking?.id || ''} />}{isBooking && <><label>Nome da cliente<input name="clientName" defaultValue={booking?.clientName} required minLength={2} maxLength={120} /></label><div className="modal-grid"><label>WhatsApp<input name="whatsapp" defaultValue={booking?.whatsapp} required /></label><label>E-mail<input name="email" type="email" defaultValue={booking?.email || ''} /></label></div><label>Serviço<select name="service" defaultValue={booking?.service || Object.keys(SERVICE_CATALOG)[0]}>{Object.entries(SERVICE_CATALOG).map(([id, service]) => <option key={id} value={id}>{service.label} · {money(service.priceCents)}</option>)}</select></label><div className="modal-grid"><label>Data<input name="date" type="date" defaultValue={booking?.appointmentDate || agendaDate} required /></label><label>Horário<select name="time" defaultValue={booking?.appointmentTime || BOOKING_TIMES[0]}>{BOOKING_TIMES.map((time) => <option key={time}>{time}</option>)}</select></label></div>{mode === 'booking' && <><label>Forma de pagamento<select name="paymentOption" defaultValue="deposit"><option value="deposit">Sinal de 50%</option><option value="full">Valor integral</option></select></label><label className="modal-check"><input name="paid" type="checkbox" /> Pagamento já foi recebido</label></>}<label>Observações<textarea name="notes" defaultValue={booking?.notes || ''} maxLength={1200} rows={3} /></label></>}{mode === 'block' && <><label>Data<input name="date" type="date" defaultValue={agendaDate} required /></label><label className="modal-check"><input name="fullDay" type="checkbox" defaultChecked onChange={(event) => setFullDay(event.target.checked)} /> Bloquear o dia inteiro</label>{!fullDay && <div className="modal-grid"><label>Início<input name="startTime" type="time" required /></label><label>Fim<input name="endTime" type="time" required /></label></div>}<label>Motivo<input name="reason" placeholder="Ex.: compromisso pessoal" required maxLength={120} /></label></>}{mode === 'expense' && <><div className="modal-grid"><label>Data<input name="date" type="date" defaultValue={agendaDate} required /></label><label>Valor (R$)<input name="amount" inputMode="decimal" placeholder="0,00" required /></label></div><label>Descrição<input name="description" placeholder="Ex.: reposição de produtos" required maxLength={160} /></label><label>Categoria<select name="category"><option>Produtos</option><option>Transporte</option><option>Espaço</option><option>Marketing</option><option>Impostos</option><option>Outros</option></select></label></>}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button></footer></form></section></div>;
}

function groupClients(bookings: Booking[]) {
  const clients = new Map<string, { key: string; name: string; whatsapp: string; email: string; bookings: number; value: number; lastBookingId: string; lastCreatedAt: number }>();
  for (const booking of bookings) {
    const key = booking.whatsapp.replace(/\D/g, '') || booking.email || booking.clientName;
    const current = clients.get(key) || { key, name: booking.clientName, whatsapp: booking.whatsapp, email: booking.email || '', bookings: 0, value: 0, lastBookingId: booking.id, lastCreatedAt: booking.createdAt };
    current.bookings += 1; current.value += booking.priceCents;
    if (booking.createdAt >= current.lastCreatedAt) { current.lastBookingId = booking.id; current.lastCreatedAt = booking.createdAt; }
    clients.set(key, current);
  }
  return [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function groupByAppointmentDay(bookings: Booking[], expenses: Expense[]): DayGroup[] {
  const dates = new Set([...bookings.map((booking) => booking.appointmentDate), ...expenses.map((expense) => expense.expenseDate)]);
  return [...dates].sort().map((date) => {
    const dayBookings = bookings.filter((booking) => booking.appointmentDate === date).sort(byTime);
    const confirmed = dayBookings.filter((booking) => booking.paymentStatus === 'pago');
    const contracted = confirmed.reduce((total, booking) => total + booking.priceCents, 0);
    const received = confirmed.reduce((total, booking) => total + receivedCents(booking), 0);
    const outstanding = confirmed.reduce((total, booking) => total + Math.max(0, booking.priceCents - receivedCents(booking)), 0);
    const spent = expenses.filter((expense) => expense.expenseDate === date).reduce((total, expense) => total + expense.amountCents, 0);
    return { date, bookings: dayBookings, contracted, received, outstanding, expenses: spent, result: received - spent };
  });
}

function sum(items: Booking[], field: 'priceCents' | 'depositCents' | 'paymentAmountCents') { return items.reduce((total, booking) => total + booking[field], 0); }
function receivedCents(booking: Booking) { return (booking.paymentStatus === 'pago' ? booking.paymentAmountCents : 0) + booking.balancePaidCents; }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function formatDate(value: string) { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
function iso(value: Date) { return value.toISOString().slice(0, 10); }
function addDays(value: Date, days: number) { const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result; }
function byTime(a: Booking, b: Booking) { return a.appointmentTime.localeCompare(b.appointmentTime); }
function byAppointment(a: Booking, b: Booking) { return `${a.appointmentDate}${a.appointmentTime}`.localeCompare(`${b.appointmentDate}${b.appointmentTime}`); }
function weekday(value: Date) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(value).replace('.', ''); }
function weekdayName(value: string) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function todayInSaoPaulo() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function todayFromTimestamp(timestamp: number) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp)); }
function longDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function whatsappUrl(value: string) { return `https://wa.me/55${value.replace(/\D/g, '').replace(/^55/, '')}`; }
function paymentGuidance(status: string) { return ({ em_analise: 'O provedor está analisando', aguardando: 'Link gerado, pagamento não concluído', rejeitado: 'Pagamento recusado', expirado: 'Prazo de pagamento encerrado', configuracao_pendente: 'Integração ainda indisponível', nao_aplicavel: 'Valor será combinado pelo WhatsApp' } as Record<string, string>)[status] || 'Confira os dados da reserva'; }
function paymentLabel(status: string) { return ({ pago: 'Pago', em_analise: 'Em análise', aguardando: 'Aguardando', rejeitado: 'Recusado', cancelado: 'Cancelado', expirado: 'Expirado', estornado: 'Estornado', nao_aplicavel: 'Sob consulta', configuracao_pendente: 'Pagamento indisponível' } as Record<string, string>)[status] || status.replaceAll('_', ' '); }
function paymentProviderLabel(provider: string | null) { return provider === 'infinitepay' ? 'InfinitePay' : provider === 'mercado_pago' ? 'Mercado Pago' : provider === 'demo' ? 'Demonstração' : provider === 'manual' ? 'Confirmação manual' : 'Pagamento ainda não iniciado'; }
