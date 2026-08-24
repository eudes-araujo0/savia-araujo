'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CreditCard, ShieldCheck } from 'lucide-react';

const services = [
  { code: 'social', name: 'Maquiagem social', note: 'Eventos, formaturas e celebrações', price: 'R$ 220', priceCents: 22000 },
  { code: 'noiva', name: 'Experiência noiva', note: 'Teste + produção no grande dia', price: 'R$ 790', priceCents: 79000 },
  { code: 'editorial', name: 'Editorial & ensaio', note: 'Fotos, conteúdo e campanhas', price: 'Sob consulta', priceCents: 0 },
];

const times = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

type BookingData = {
  service: string;
  date: string;
  time: string;
  name: string;
  whatsapp: string;
  email: string;
  notes: string;
  paymentOption: 'deposit' | 'full';
};

const initialData: BookingData = { service: '', date: '', time: '', name: '', whatsapp: '', email: '', notes: '', paymentOption: 'deposit' };

type Props = { initialService: string; initialPayment: string; initialBooking: string; initialPaymentId: string };

export default function BookingFlow({ initialService, initialPayment, initialBooking, initialPaymentId }: Props) {
  const requestedService = services.some((service) => service.code === initialService) ? initialService : '';
  const returnedFromPayment = Boolean(initialPayment && initialBooking);
  const [step, setStep] = useState(returnedFromPayment ? 4 : 1);
  const [data, setData] = useState({ ...initialData, service: requestedService });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState(returnedFromPayment ? initialBooking : '');
  const [unavailableTimes, setUnavailableTimes] = useState<string[]>([]);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [returnStatus] = useState(returnedFromPayment ? initialPayment : '');

  useEffect(() => {
    if (initialPayment !== 'success' || !initialBooking || !initialPaymentId) return;
    fetch('/api/payments/reconcile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingId: initialBooking, paymentId: initialPaymentId, action: 'sync' }),
    })
      .then(async (response) => ({ ok: response.ok, result: await response.json() as { error?: string } }))
      .then(({ ok, result }) => {
        setPaymentNotice(ok ? 'Pagamento conferido e reserva atualizada.' : (result.error || 'A confirmação automática ainda está sendo processada.'));
      })
      .catch(() => setPaymentNotice('A confirmação automática ainda está sendo processada.'));
  }, [initialBooking, initialPayment, initialPaymentId]);

  useEffect(() => {
    if (!data.date) return;
    let active = true;
    fetch(`/api/bookings/availability?date=${encodeURIComponent(data.date)}`)
      .then((response) => response.ok ? response.json() : { unavailable: [] })
      .then((result: { unavailable?: string[] }) => {
        if (!active) return;
        const unavailable = result.unavailable || [];
        setUnavailableTimes(unavailable);
        setData((current) => unavailable.includes(current.time) ? { ...current, time: '' } : current);
      });
    return () => { active = false; };
  }, [data.date]);

  const selectedService = useMemo(() => services.find((service) => service.code === data.service), [data.service]);
  const today = new Date().toISOString().slice(0, 10);

  function nextStep() {
    setError('');
    if (step === 1 && !data.service) return setError('Escolha uma experiência para continuar.');
    if (step === 2 && (!data.date || !data.time)) return setError('Escolha a data e o horário desejados.');
    setStep((current) => Math.min(3, current + 1));
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!data.name || !data.whatsapp) return setError('Informe seu nome e WhatsApp para finalizar.');

    const payload = new FormData();
    Object.entries(data).forEach(([key, value]) => payload.append(key, value));
    setSubmitting(true);
    try {
      const response = await fetch('/api/bookings', { method: 'POST', body: payload });
      const result = (await response.json()) as { id?: string; error?: string; paymentAmountCents?: number; paymentUrl?: string | null; paymentMode?: string; paymentError?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar o agendamento.');
      setBookingId(result.id || 'confirmado');
      setPaymentAmountCents(result.paymentAmountCents || 0);
      setPaymentUrl(result.paymentUrl || null);
      setPaymentMode(result.paymentMode || '');
      setPaymentNotice(result.paymentError || '');
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
        <img src="/media/bride-getting-ready-bw.jpg" alt="Noiva sorrindo enquanto recebe a maquiagem" />
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
              <div className="service-options">
                {services.map((service) => (
                  <button type="button" key={service.code} className={`service-option ${data.service === service.code ? 'selected' : ''}`} onClick={() => setData({ ...data, service: service.code })} aria-pressed={data.service === service.code}>
                    <div><h3>{service.name}</h3><p>{service.note}</p></div>
                    <strong>{service.price}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <span className="booking-step-label">Etapa 02 · Agenda</span>
              <h2>Quando será<br />o seu momento?</h2>
              <div className="form-grid">
                <div className="form-field full">
                  <label htmlFor="date">Data desejada</label>
                  <input id="date" type="date" min={today} value={data.date} onChange={(event) => { setUnavailableTimes([]); setData({ ...data, date: event.target.value, time: '' }); }} required />
                </div>
                <div className="form-field full">
                  <label>Horário de preferência</label>
                  <div className="time-grid">
                    {times.map((time) => <button type="button" key={time} disabled={unavailableTimes.includes(time)} className={`time-option ${data.time === time ? 'selected' : ''}`} onClick={() => setData({ ...data, time })}>{time}{unavailableTimes.includes(time) ? <small>ocupado</small> : null}</button>)}
                  </div>
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
                <div className="form-field full"><label htmlFor="email">E-mail</label><input id="email" type="email" value={data.email} onChange={(event) => setData({ ...data, email: event.target.value })} placeholder="voce@email.com" /></div>
                <div className="form-field full"><label htmlFor="notes">Conte um pouco sobre o evento</label><textarea id="notes" value={data.notes} onChange={(event) => setData({ ...data, notes: event.target.value })} placeholder="Tipo de evento, local, referências ou algum detalhe importante..." /></div>
                {selectedService && selectedService.priceCents > 0 && <div className="payment-choice full">
                  <span className="payment-choice-label">Como deseja pagar pelo site?</span>
                  <div className="payment-choice-grid">
                    <button type="button" className={data.paymentOption === 'deposit' ? 'selected' : ''} onClick={() => setData({ ...data, paymentOption: 'deposit' })}><strong>Sinal de 50%</strong><small>{money(selectedService.priceCents / 2)} agora</small></button>
                    <button type="button" className={data.paymentOption === 'full' ? 'selected' : ''} onClick={() => setData({ ...data, paymentOption: 'full' })}><strong>Valor integral</strong><small>{money(selectedService.priceCents)} agora</small></button>
                  </div>
                  <div className="payment-summary"><ShieldCheck size={20} /><div><strong>{data.paymentOption === 'full' ? 'Pagamento integral pelo Mercado Pago' : 'Reserva confirmada com 50%'}</strong><p>{data.paymentOption === 'full' ? 'O atendimento fica totalmente pago após a aprovação.' : `O restante, ${money(selectedService.priceCents / 2)}, fica para o atendimento.`}</p></div></div>
                </div>}
                {selectedService?.priceCents === 0 && <div className="payment-summary full"><ShieldCheck size={20} /><div><strong>Valor sob consulta</strong><p>Após receber a solicitação, a equipe confirma orçamento e condições pelo WhatsApp.</p></div></div>}
              </div>
              <p className="demo-note">Solicitação: {selectedService?.name} · {data.date.split('-').reverse().join('/')} às {data.time}</p>
            </div>
          )}

          {step === 4 && (
            <div className="booking-success">
              <div className="success-icon">{paymentUrl ? <CreditCard size={28} /> : <Check size={30} />}</div>
              <span className="booking-step-label">{returnStatus === 'success' ? 'Pagamento recebido' : paymentUrl ? 'Horário pré-reservado' : 'Solicitação recebida'}</span>
              <h2>{returnStatus === 'success' ? <>Reserva<br />confirmada.</> : paymentUrl ? <>Falta apenas<br />o sinal.</> : <>Seu momento<br />já começou.</>}</h2>
              {returnStatus === 'success' ? <p>{paymentNotice || 'O pagamento foi recebido e a confirmação automática está sendo registrada. Você também receberá os detalhes pelo WhatsApp.'}</p> : paymentUrl ? <p>Para confirmar o horário, faça o pagamento de <strong>{money(paymentAmountCents)}</strong> pelo Mercado Pago.</p> : <p>{paymentNotice || 'Recebemos seu pedido. A equipe entrará em contato pelo WhatsApp para concluir os detalhes.'}</p>}
              {paymentMode === 'demo' && paymentUrl && <p className="demo-payment-note">Demonstração: nenhuma cobrança real será feita.</p>}
              <p className="demo-note">Código da solicitação: {bookingId}</p>
              {paymentUrl && !returnStatus && <a className="button button-dark" href={paymentUrl}>{paymentMode === 'demo' ? 'Simular pagamento escolhido' : 'Pagar no Mercado Pago'} <ArrowRight size={16} /></a>}
              <Link className="button button-dark" href="/">Voltar ao início</Link>
            </div>
          )}

          {error && <p className="booking-error" role="alert">{error}</p>}
          {step < 4 && (
            <div className="booking-actions">
              {step > 1 && <button className="back-button" type="button" onClick={() => setStep((current) => current - 1)}>Voltar</button>}
              {step < 3 ? <button className="button button-dark" type="button" onClick={nextStep}>Continuar <ArrowRight size={16} /></button> : <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? 'Enviando...' : selectedService?.priceCents ? 'Continuar para o pagamento' : 'Solicitar orçamento'} <ArrowRight size={16} /></button>}
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
