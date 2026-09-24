'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CreditCard, ShieldCheck } from 'lucide-react';
import type { BookableService } from '../../lib/service-catalog';
import type { BusinessSchedule } from '../../db/schema';
import { useSiteMedia } from '../../lib/use-site-media';
import { managedMediaStyle, type SiteMediaValue } from '../../lib/site-media';
import { buildScheduleTimes } from '../../lib/business-hours';

const serviceGroups = ['makeup', 'noivas', 'boss'] as const;

type BookingData = {
  service: string;
  date: string;
  time: string;
  name: string;
  whatsapp: string;
  email: string;
  notes: string;
  paymentOption: 'deposit' | 'full';
  consent: boolean;
};

type AvailabilityResult = { times: string[]; unavailable: string[]; closed: boolean };

const initialData: BookingData = { service: '', date: '', time: '', name: '', whatsapp: '', email: '', notes: '', paymentOption: 'deposit', consent: false };

type Props = { initialMedia: SiteMediaValue[]; initialServices: BookableService[]; initialSchedule: BusinessSchedule; initialService: string; initialPayment: string; initialBooking: string; initialToken: string; initialTransactionNsu: string; initialSlug: string; initialReceiptUrl: string };

export default function BookingFlow({ initialMedia, initialServices: services, initialSchedule, initialService, initialPayment, initialBooking, initialToken, initialTransactionNsu, initialSlug, initialReceiptUrl }: Props) {
  const getMedia = useSiteMedia(initialMedia);
  const requestedService = services.some((service) => service.code === initialService) ? initialService : '';
  const requestedGroup = services.find((service) => service.code === requestedService)?.group || 'makeup';
  const returnedFromPayment = Boolean(initialPayment && initialBooking);
  const [step, setStep] = useState(returnedFromPayment ? 4 : 1);
  const [data, setData] = useState({ ...initialData, service: requestedService });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState(returnedFromPayment ? initialBooking : '');
  const [times, setTimes] = useState<string[]>([]);
  const [unavailableTimes, setUnavailableTimes] = useState<string[]>([]);
  const [availabilityClosed, setAvailabilityClosed] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, AvailabilityResult>>({});
  const requestedMonths = useRef(new Set<string>());
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [returnStatus] = useState(returnedFromPayment ? initialPayment : '');
  const [activeGroup, setActiveGroup] = useState<(typeof serviceGroups)[number]>(requestedGroup);
  const [manageUrl, setManageUrl] = useState(returnedFromPayment && initialToken ? `/reserva/${encodeURIComponent(initialBooking)}?token=${encodeURIComponent(initialToken)}` : '');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [calendarMonth, setCalendarMonth] = useState(`${today.slice(0, 7)}-01`);

  useEffect(() => {
    if (initialPayment !== 'success' || !initialBooking || !(initialTransactionNsu && initialSlug)) return;
    fetch('/api/payments/reconcile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingId: initialBooking, transactionNsu: initialTransactionNsu, slug: initialSlug, receiptUrl: initialReceiptUrl || undefined, action: 'sync' }),
    })
      .then(async (response) => ({ ok: response.ok, result: await response.json() as { error?: string } }))
      .then(({ ok, result }) => {
        setPaymentConfirmed(ok);
        setPaymentNotice(ok ? 'Pagamento conferido e reserva atualizada.' : (result.error || 'A confirmação automática ainda está sendo processada.'));
      })
      .catch(() => setPaymentNotice('A confirmação automática ainda está sendo processada.'));
  }, [initialBooking, initialPayment, initialTransactionNsu, initialSlug, initialReceiptUrl]);

  useEffect(() => {
    if (!data.date || !data.service) return;
    const cached = availabilityByDate[data.date];
    if (cached) return;
    let active = true;
    fetch(`/api/bookings/availability?date=${encodeURIComponent(data.date)}&service=${encodeURIComponent(data.service)}`)
      .then(async (response) => {
        const result = await response.json() as { times?: string[]; unavailable?: string[]; closed?: boolean; error?: string };
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a agenda.');
        return result;
      })
      .then((result) => {
        if (!active) return;
        const unavailable = result.unavailable || [];
        setTimes(result.times || []);
        setUnavailableTimes(unavailable);
        setAvailabilityClosed(Boolean(result.closed));
        setAvailabilityByDate((current) => ({ ...current, [data.date]: { times: result.times || [], unavailable, closed: Boolean(result.closed) } }));
        setData((current) => unavailable.includes(current.time) ? { ...current, time: '' } : current);
      })
      .catch((requestError) => { if (active) { setTimes([]); setUnavailableTimes([]); setError(requestError instanceof Error ? requestError.message : 'Não foi possível consultar a agenda.'); } })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [data.date, data.service, availabilityByDate]);

  useEffect(() => {
    if (!data.service) return;
    const month = calendarMonth.slice(0, 7);
    const cacheKey = `${data.service}:${month}`;
    if (requestedMonths.current.has(cacheKey)) return;
    requestedMonths.current.add(cacheKey);
    fetch(`/api/bookings/availability?month=${encodeURIComponent(month)}&service=${encodeURIComponent(data.service)}`)
      .then(async (response) => {
        const result = await response.json() as { days?: Record<string, AvailabilityResult>; error?: string };
        if (!response.ok) throw new Error(result.error || 'Não foi possível preparar a agenda.');
        return result.days || {};
      })
      .then((days) => setAvailabilityByDate((current) => ({ ...current, ...days })))
      .catch(() => requestedMonths.current.delete(cacheKey));
  }, [calendarMonth, data.service]);

  const selectedService = useMemo(() => services.find((service) => service.code === data.service), [data.service, services]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth, today, initialSchedule.openDays), [calendarMonth, today, initialSchedule.openDays]);
  const cachedAvailability = data.date ? availabilityByDate[data.date] : undefined;
  const displayedTimes = cachedAvailability?.times || times;
  const displayedUnavailableTimes = cachedAvailability?.unavailable || unavailableTimes;
  const displayedAvailabilityClosed = cachedAvailability?.closed ?? availabilityClosed;
  const displayedAvailabilityLoading = Boolean(data.date && !cachedAvailability && availabilityLoading);

  function nextStep() {
    setError('');
    if (step === 1 && !data.service) return setError('Escolha uma experiência para continuar.');
    if (step === 2 && (!data.date || !data.time)) return setError('Escolha a data e o horário desejados.');
    setStep((current) => Math.min(3, current + 1));
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!data.name || !data.whatsapp || !data.email) return setError('Informe seu nome, WhatsApp e e-mail para finalizar.');
    if (!data.consent) return setError('Confirme que leu os termos e a política de privacidade.');

    const payload = new FormData();
    Object.entries(data).forEach(([key, value]) => payload.append(key, key === 'consent' ? (value ? 'accepted' : '') : String(value)));
    setSubmitting(true);
    try {
      const response = await fetch('/api/bookings', { method: 'POST', body: payload });
      const result = (await response.json()) as { id?: string; error?: string; paymentAmountCents?: number; paymentUrl?: string | null; paymentMode?: string; paymentError?: string; manageUrl?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar o agendamento.');
      if (result.paymentUrl) {
        window.location.replace(result.paymentUrl);
        return;
      }
      setBookingId(result.id || 'confirmado');
      setPaymentAmountCents(result.paymentAmountCents || 0);
      setPaymentUrl(null);
      setPaymentNotice(result.paymentError || '');
      setManageUrl(result.manageUrl || '');
      setStep(4);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível registrar o agendamento.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="booking-page">
      <aside className="booking-visual">
        <Image className="managed-media" src={getMedia('booking.cover').url} alt={getMedia('booking.cover').alt} fill sizes="(max-width: 760px) 100vw, 42vw" preload style={managedMediaStyle(getMedia('booking.cover'))} />
        <Link className="brand" href="/">SÁVIA <span>ARAÚJO</span></Link>
        <div className="booking-visual-copy">
          <p className="eyebrow">Atendimento exclusivo</p>
          <h1>Reserve o seu<br /><em>momento.</em></h1>
          <p>Cada atendimento é preparado com tempo, escuta e todos os detalhes que fazem você se sentir inesquecível.</p>
        </div>
      </aside>

      <section className="booking-shell">
        <div className="booking-topbar">
          <Link href="/"><ArrowLeft size={14} /> Voltar ao site</Link>
          <div className="booking-progress" aria-label={`Etapa ${Math.min(step, 3)} de 3`}>
            {[1, 2, 3].map((item) => <span key={item} className={item <= step ? 'active' : ''} />)}
          </div>
        </div>

        <form className="booking-content" onSubmit={submitBooking}>
          {step === 1 && (
            <div>
              <span className="booking-step-label">Etapa 01 · Experiência</span>
              <h2>Como você quer<br />se sentir?</h2>
              <div className="service-group-tabs" role="tablist" aria-label="Categorias de experiências">
                {serviceGroups.map((group) => {
                  const label = services.find((service) => service.group === group)?.groupLabel || group;
                  return <button type="button" role="tab" aria-selected={activeGroup === group} className={activeGroup === group ? 'active' : ''} key={group} onClick={() => setActiveGroup(group)}>{label}</button>;
                })}
              </div>
              <div className="service-groups">
                <section className="booking-service-group">
                  <p className="service-group-title">Escolha uma opção</p>
                  <div className="service-options">
                    {services.filter((service) => service.group === activeGroup).map((service) => (
                      <button type="button" key={service.code} className={`service-option ${data.service === service.code ? 'selected' : ''}`} onClick={() => { setTimes([]); setUnavailableTimes([]); setAvailabilityByDate({}); setAvailabilityClosed(false); setAvailabilityLoading(false); setData({ ...data, service: service.code, date: '', time: '' }); }} aria-pressed={data.service === service.code}>
                        <div><h3>{service.name}</h3><p>{service.tagline} · {service.description}</p></div>
                        <strong>{money(service.priceCents)}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <p className="booking-trust"><ShieldCheck size={15} /> Pagamento protegido · sinal de 50% ou valor integral</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <span className="booking-step-label">Etapa 02 · Agenda</span>
              <h2>Quando será<br />o seu momento?</h2>
              {selectedService?.group === 'noivas' && <p className="availability-note">O Dia da Noiva é exclusivo: ao confirmar, a data fica reservada para você e sua família.</p>}
              {selectedService?.group === 'boss' && <p className="availability-note">O Pacote Boss acontece em estúdio e dura, em média, de 2 a 3 horas.</p>}
              <div className="form-grid">
                <div className="form-field full">
                  <label>Data desejada</label>
                  <div className="booking-calendar" aria-label="Calendário de agendamento">
                    <div className="booking-calendar-head">
                      <button type="button" aria-label="Mês anterior" disabled={calendarMonth <= `${today.slice(0, 7)}-01`} onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}><ChevronLeft size={16} /></button>
                      <strong>{monthLabel(calendarMonth)}</strong>
                      <button type="button" aria-label="Próximo mês" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}><ChevronRight size={16} /></button>
                    </div>
                    <div className="booking-calendar-weekdays" aria-hidden="true">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
                    <div className="booking-calendar-grid">
                      {calendarDays.map((day) => day.hidden
                        ? <span className="booking-calendar-empty" key={day.date} aria-hidden="true" />
                        : <button type="button" key={day.date} className={data.date === day.date ? 'selected' : ''} disabled={day.disabled} aria-label={longCalendarDate(day.date)} aria-pressed={data.date === day.date} onClick={() => {
                          const cached = availabilityByDate[day.date];
                          const previewTimes = cached?.times || (selectedService ? buildScheduleTimes(initialSchedule, day.date, selectedService.durationMinutes) : []);
                          setError('');
                          setTimes(previewTimes);
                          setUnavailableTimes(cached?.unavailable || previewTimes);
                          setAvailabilityClosed(cached?.closed || false);
                          setAvailabilityLoading(!cached);
                          setData({ ...data, date: day.date, time: '' });
                        }}>{day.day}</button>)}
                    </div>
                  </div>
                  <small className="calendar-help">Datas passadas não são exibidas. Dias sem atendimento ficam indisponíveis automaticamente.</small>
                </div>
                <div className="form-field full">
                  <label>Horário de preferência</label>
                  <div className="time-grid">
                    {displayedTimes.map((time) => <button type="button" key={time} disabled={displayedAvailabilityLoading || displayedUnavailableTimes.includes(time)} className={`time-option ${displayedAvailabilityLoading ? 'checking' : ''} ${data.time === time ? 'selected' : ''}`} onClick={() => setData({ ...data, time })}>{time}{displayedAvailabilityLoading ? <small>verificando</small> : displayedUnavailableTimes.includes(time) ? <small>indisponível</small> : null}</button>)}
                  </div>
                  {!data.date && <p className="availability-feedback">Escolha uma data para ver os horários.</p>}
                  {displayedAvailabilityLoading && <p className="availability-feedback">Consultando a agenda...</p>}
                  {data.date && displayedAvailabilityClosed && <p className="availability-feedback warning">Não há atendimento neste dia da semana.</p>}
                  {data.date && !displayedAvailabilityClosed && !displayedAvailabilityLoading && displayedTimes.length > 0 && displayedTimes.every((time) => displayedUnavailableTimes.includes(time)) && <p className="availability-feedback warning">Não há mais horários disponíveis nesta data.</p>}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <span className="booking-step-label">Etapa 03 · Seus dados</span>
              <h2>Quase tudo<br />pronto.</h2>
              <div className="form-grid">
                <div className="form-field"><label htmlFor="name">Nome completo</label><input id="name" value={data.name} onChange={(event) => setData({ ...data, name: event.target.value })} placeholder="Como podemos chamar você?" required /></div>
                <div className="form-field"><label htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" value={data.whatsapp} onChange={(event) => setData({ ...data, whatsapp: event.target.value })} placeholder="(81) 99999-9999" required /></div>
                <div className="form-field full"><label htmlFor="email">E-mail para confirmação</label><input id="email" type="email" value={data.email} onChange={(event) => setData({ ...data, email: event.target.value })} placeholder="voce@email.com" autoComplete="email" required /><small>Pagamento e agendamento serão confirmados neste endereço.</small></div>
                <div className="form-field full"><label htmlFor="notes">Conte um pouco sobre o evento</label><textarea id="notes" value={data.notes} onChange={(event) => setData({ ...data, notes: event.target.value })} placeholder="Tipo de evento, local, referências ou algum detalhe importante..." /></div>
                {selectedService && selectedService.priceCents > 0 && <div className="payment-choice full">
                  <span className="payment-choice-label">Como deseja pagar pelo site?</span>
                  <div className="payment-choice-grid">
                    <button type="button" className={data.paymentOption === 'deposit' ? 'selected' : ''} onClick={() => setData({ ...data, paymentOption: 'deposit' })}><strong>Sinal de 50%</strong><small>{money(selectedService.priceCents / 2)} agora</small></button>
                    <button type="button" className={data.paymentOption === 'full' ? 'selected' : ''} onClick={() => setData({ ...data, paymentOption: 'full' })}><strong>Valor integral</strong><small>{money(selectedService.priceCents)} agora</small></button>
                  </div>
                  <div className="payment-summary"><ShieldCheck size={20} /><div><strong>{data.paymentOption === 'full' ? 'Pagamento integral online' : 'Reserva confirmada com 50%'}</strong><p>{data.paymentOption === 'full' ? 'O atendimento fica totalmente pago após a aprovação.' : `O restante, ${money(selectedService.priceCents / 2)}, fica para o atendimento.`}</p></div></div>
                </div>}
                {selectedService?.priceCents === 0 && <div className="payment-summary full"><ShieldCheck size={20} /><div><strong>Valor sob consulta</strong><p>Após receber a solicitação, a equipe confirma orçamento e condições pelo WhatsApp.</p></div></div>}
                <label className="booking-consent full"><input type="checkbox" checked={data.consent} onChange={(event) => setData({ ...data, consent: event.target.checked })} required /><span>Li e aceito os <Link href="/termos" target="_blank">termos do agendamento</Link> e a <Link href="/privacidade" target="_blank">política de privacidade</Link>.</span></label>
              </div>
              <p className="booking-note">Solicitação: {selectedService?.name} · {data.date.split('-').reverse().join('/')} às {data.time}</p>
            </div>
          )}

          {step === 4 && (
            <div className="booking-success">
              <div className="success-icon">{paymentUrl ? <CreditCard size={28} /> : <Check size={30} />}</div>
              <span className="booking-step-label">{returnStatus === 'success' ? (paymentConfirmed ? 'Pagamento recebido' : 'Conferindo pagamento') : returnStatus === 'pending' ? 'Pagamento em análise' : returnStatus === 'failure' ? 'Pagamento não concluído' : paymentUrl ? 'Horário pré-reservado por 30 minutos' : 'Solicitação recebida'}</span>
              <h2>{returnStatus === 'success' ? (paymentConfirmed ? <>Reserva<br />confirmada.</> : <>Estamos<br />confirmando.</>) : returnStatus === 'pending' ? <>Estamos<br />confirmando.</> : returnStatus === 'failure' ? <>Você pode<br />tentar novamente.</> : paymentUrl ? <>Falta apenas<br />o pagamento.</> : <>Seu momento<br />já começou.</>}</h2>
              {returnStatus === 'success' ? <p>{paymentConfirmed ? 'Pagamento conferido e reserva confirmada. Você receberá os detalhes pelo canal informado.' : (paymentNotice || 'Aguarde enquanto conferimos a transação diretamente com o provedor.')}</p> : returnStatus === 'pending' ? <p>O pagamento ainda está em análise. Assim que aprovar, a reserva será confirmada automaticamente.</p> : returnStatus === 'failure' ? <p>O pagamento não foi concluído. Acesse sua reserva abaixo para gerar uma nova tentativa enquanto o horário estiver disponível.</p> : paymentUrl ? <p>Para confirmar o horário, faça o pagamento de <strong>{money(paymentAmountCents)}</strong> em até 30 minutos.</p> : <p>{paymentNotice || 'Recebemos seu pedido. A equipe entrará em contato pelo WhatsApp para concluir os detalhes.'}</p>}
              <p className="booking-note">Código da solicitação: {bookingId}</p>
              {paymentUrl && !returnStatus && <a className="button button-dark" href={paymentUrl}>Pagar com InfinitePay <ArrowRight size={16} /></a>}
              {manageUrl && <Link className="button button-outline" href={manageUrl}>Gerenciar minha reserva <ArrowRight size={16} /></Link>}
              <Link className="button button-dark" href="/">Voltar ao início</Link>
            </div>
          )}

          {error && <p className="booking-error" role="alert">{error}</p>}
          {step > 1 && step < 4 && selectedService && <div className="booking-selection-summary">
            <div><small>Experiência</small><strong>{selectedService.name}</strong></div>
            <div><small>Quando</small><strong>{data.date ? `${data.date.split('-').reverse().join('/')}${data.time ? ` · ${data.time}` : ''}` : 'A escolher'}</strong></div>
            <div><small>Investimento</small><strong>{money(selectedService.priceCents)}</strong></div>
          </div>}
          {step < 4 && (
            <div className="booking-actions">
              {step > 1 && <button className="back-button" type="button" onClick={() => setStep((current) => current - 1)}>Voltar</button>}
              {step < 3 ? <button className="button button-dark" type="button" onClick={nextStep}>Continuar <ArrowRight size={16} /></button> : <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? (selectedService?.priceCents ? 'Abrindo pagamento...' : 'Enviando...') : selectedService?.priceCents ? 'Finalizar e ir para o pagamento' : 'Solicitar orçamento'} <ArrowRight size={16} /></button>}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function buildCalendarDays(month: string, today: string, openDays: number[]) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const last = new Date(Date.UTC(year, monthNumber, 0));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  if (month.slice(0, 7) === today.slice(0, 7)) {
    const current = new Date(`${today}T12:00:00Z`);
    const currentWeekStart = new Date(current);
    currentWeekStart.setUTCDate(current.getUTCDate() - current.getUTCDay());
    if (currentWeekStart > start) start.setTime(currentWeekStart.getTime());
  }
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const length = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const inMonth = date.getUTCMonth() === monthNumber - 1;
    const hidden = !inMonth || iso < today;
    return { date: iso, day: date.getUTCDate(), hidden, disabled: hidden || !openDays.includes(date.getUTCDay()) };
  });
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return date.toISOString().slice(0, 10);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`));
}

function longCalendarDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
