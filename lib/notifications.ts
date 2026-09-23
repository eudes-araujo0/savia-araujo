import type { Booking } from '../db/schema';
import { finishNotification, reserveNotification } from '../db/bookings';
import { runtimeValue } from './runtime-env';

export type NotificationKind = 'booking_created' | 'payment_approved' | 'balance_received' | 'reminder_48h' | 'reminder_24h' | 'rescheduled' | 'cancelled';
type Recipient = 'client' | 'owner';

export async function notifyBooking(booking: Booking, kind: NotificationKind, managementUrl = '') {
  const webhookUrl = runtimeValue('NOTIFICATION_WEBHOOK_URL');
  const resendKey = runtimeValue('RESEND_API_KEY');
  const ownerEmail = runtimeValue('NOTIFICATION_OWNER_EMAIL');
  if (!webhookUrl && !resendKey) return { delivered: false, configured: false };

  const content = notificationContent(booking, kind, managementUrl);
  const eventKey = kind === 'balance_received' ? `${kind}-${paidTotal(booking)}` : kind;
  const deliveries: Promise<boolean>[] = [];

  if (webhookUrl) {
    deliveries.push(deliverOnce(booking.id, `${eventKey}:webhook`, async () => {
      const serialized = JSON.stringify({
        event: kind,
        sentAt: new Date().toISOString(),
        booking: {
          id: booking.id,
          clientName: booking.clientName,
          whatsapp: booking.whatsapp,
          email: booking.email,
          service: booking.serviceLabel,
          date: booking.appointmentDate,
          time: booking.appointmentTime,
          totalCents: booking.priceCents,
          amountPaidCents: paidTotal(booking),
          balanceCents: openBalance(booking),
          paymentOption: booking.paymentOption,
          paymentId: booking.paymentId,
          managementUrl,
        },
        messages: { subject: content.clientSubject, client: content.clientText, owner: content.ownerText },
      });
      return fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-savia-signature': await sign(serialized, runtimeValue('NOTIFICATION_WEBHOOK_SECRET')),
        },
        body: serialized,
        signal: AbortSignal.timeout(10000),
      });
    }));
  }

  if (resendKey && booking.email) {
    deliveries.push(deliverOnce(booking.id, `${eventKey}:client`, () => sendResend({
      apiKey: resendKey,
      to: booking.email!,
      subject: content.clientSubject,
      text: content.clientText,
      html: emailHtml(booking, kind, 'client', managementUrl),
      idempotencyKey: `savia/${eventKey}/client/${booking.id}`,
      replyTo: ownerEmail,
    })));
  }

  if (resendKey && ownerEmail) {
    deliveries.push(deliverOnce(booking.id, `${eventKey}:owner`, () => sendResend({
      apiKey: resendKey,
      to: ownerEmail,
      subject: content.ownerSubject,
      text: content.ownerText,
      html: emailHtml(booking, kind, 'owner', managementUrl),
      idempotencyKey: `savia/${eventKey}/owner/${booking.id}`,
      replyTo: booking.email || undefined,
    })));
  }

  const results = await Promise.allSettled(deliveries);
  return {
    delivered: results.some((result) => result.status === 'fulfilled' && result.value),
    configured: true,
  };
}

async function deliverOnce(bookingId: string, deliveryKind: string, deliver: () => Promise<Response>) {
  const deliveryId = await reserveNotification(bookingId, deliveryKind);
  if (!deliveryId) return true;
  try {
    const response = await deliver();
    const details = response.ok ? '' : await response.text().catch(() => `HTTP ${response.status}`);
    await finishNotification(deliveryId, response.ok, details.slice(0, 500));
    if (!response.ok) console.error('notification-delivery-failed', deliveryKind, response.status, details.slice(0, 250));
    return response.ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar notificação';
    await finishNotification(deliveryId, false, message.slice(0, 500));
    console.error('notification-delivery-failed', deliveryKind, message);
    return false;
  }
}

async function sendResend(input: { apiKey: string; to: string; subject: string; text: string; html: string; idempotencyKey: string; replyTo?: string }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: runtimeValue('NOTIFICATION_FROM_EMAIL') || 'Sávia Araújo <agendamento@resend.dev>',
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
}

function notificationContent(booking: Booking, kind: NotificationKind, managementUrl: string) {
  const date = formatDate(booking.appointmentDate);
  const manage = managementUrl ? `\n\nGerencie sua reserva: ${managementUrl}` : '';
  const address = runtimeValue('BUSINESS_ADDRESS');
  const location = address ? ` Local: ${address}.` : '';
  const paid = money(paidTotal(booking));
  const total = money(booking.priceCents);
  const balance = money(openBalance(booking));
  const paymentDetails = booking.paymentOption === 'deposit' && openBalance(booking) > 0
    ? `Pagamento recebido: ${paid}. Saldo pendente: ${balance}, que será cobrado posteriormente.`
    : `Pagamento integral recebido: ${paid}. Não há saldo pendente.`;
  const commonOwner = `${booking.clientName} · ${booking.serviceLabel} · ${date} às ${booking.appointmentTime} · Reserva ${booking.id}.`;
  const content: Record<NotificationKind, { clientSubject: string; ownerSubject: string; clientText: string; ownerText: string }> = {
    booking_created: {
      clientSubject: 'Recebemos sua solicitação de agendamento',
      ownerSubject: `[Nova solicitação] ${booking.clientName} · ${date}`,
      clientText: `Olá, ${booking.clientName}! Recebemos sua solicitação para ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}. O horário fica pré-reservado por 30 minutos enquanto você conclui o pagamento.${manage}`,
      ownerText: `Nova solicitação: ${commonOwner} Total: ${total}. Opção escolhida: ${booking.paymentOption === 'deposit' ? 'sinal de 50%' : 'pagamento integral'}. Contato: ${booking.whatsapp}${booking.email ? ` · ${booking.email}` : ''}.`,
    },
    payment_approved: {
      clientSubject: booking.paymentOption === 'deposit' ? 'Sinal aprovado e reserva confirmada' : 'Pagamento aprovado e reserva confirmada',
      ownerSubject: `[Venda confirmada] ${booking.clientName} · ${paid}`,
      clientText: `Olá, ${booking.clientName}! Seu pagamento foi aprovado e a reserva de ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}, está confirmada. ${paymentDetails}${manage}`,
      ownerText: `Venda e agendamento confirmados: ${commonOwner} ${paymentDetails} Total do serviço: ${total}. Contato: ${booking.whatsapp}${booking.email ? ` · ${booking.email}` : ''}.`,
    },
    balance_received: {
      clientSubject: openBalance(booking) > 0 ? 'Recebimento registrado na sua reserva' : 'Pagamento finalizado: sua reserva está quitada',
      ownerSubject: openBalance(booking) > 0 ? `[Recebimento parcial] ${booking.clientName}` : `[Pagamento finalizado] ${booking.clientName}`,
      clientText: `Olá, ${booking.clientName}! Registramos um novo pagamento na sua reserva ${booking.id}. Total recebido: ${paid}.${openBalance(booking) > 0 ? ` Saldo ainda pendente: ${balance}.` : ' O atendimento está integralmente pago.'}${manage}`,
      ownerText: `Recebimento registrado: ${commonOwner} Total recebido: ${paid} de ${total}.${openBalance(booking) > 0 ? ` Saldo a receber: ${balance}.` : ' Pagamento integralmente concluído.'}`,
    },
    reminder_48h: {
      clientSubject: 'Seu atendimento está chegando',
      ownerSubject: `[Lembrete enviado] ${booking.clientName} · 48 horas`,
      clientText: `Olá, ${booking.clientName}! Faltam dois dias para seu atendimento de ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}. Se precisar ajustar algum detalhe, fale conosco.${manage}`,
      ownerText: `Lembrete de 48h enviado. ${commonOwner}`,
    },
    reminder_24h: {
      clientSubject: 'É amanhã: seu atendimento com Sávia Araújo',
      ownerSubject: `[Lembrete enviado] ${booking.clientName} · amanhã`,
      clientText: `Olá, ${booking.clientName}! Seu atendimento de ${booking.serviceLabel} é amanhã, ${date}, às ${booking.appointmentTime}.${location} Chegue com alguns minutos de antecedência e siga as orientações de preparação combinadas.${manage}`,
      ownerText: `Lembrete de 24h enviado. ${commonOwner}`,
    },
    rescheduled: {
      clientSubject: 'Sua reserva foi reagendada',
      ownerSubject: `[Reserva reagendada] ${booking.clientName} · ${date}`,
      clientText: `Olá, ${booking.clientName}! Sua reserva foi atualizada para ${date} às ${booking.appointmentTime}.${manage}`,
      ownerText: `Reserva reagendada: ${commonOwner}`,
    },
    cancelled: {
      clientSubject: 'Sua solicitação de cancelamento foi registrada',
      ownerSubject: `[Reserva cancelada] ${booking.clientName}`,
      clientText: `Olá, ${booking.clientName}. Sua reserva de ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}, foi cancelada. Para informações sobre valores pagos, fale diretamente com Sávia Araújo.`,
      ownerText: `Reserva cancelada: ${commonOwner}`,
    },
  };
  return content[kind];
}

function emailHtml(booking: Booking, kind: NotificationKind, recipient: Recipient, managementUrl: string) {
  const content = notificationContent(booking, kind, managementUrl);
  const isOwner = recipient === 'owner';
  const title = emailTitle(booking, kind, isOwner);
  const intro = isOwner ? content.ownerText : content.clientText.split('\n\n')[0];
  const balance = openBalance(booking);
  const paid = paidTotal(booking);
  const showPayment = kind === 'payment_approved' || kind === 'balance_received';
  const badge = kind === 'payment_approved'
    ? (balance > 0 ? 'RESERVA CONFIRMADA COM SINAL' : 'PAGAMENTO INTEGRAL CONFIRMADO')
    : kind === 'balance_received' ? (balance > 0 ? 'RECEBIMENTO REGISTRADO' : 'PAGAMENTO FINALIZADO')
      : kind === 'booking_created' ? 'SOLICITAÇÃO RECEBIDA' : 'ATUALIZAÇÃO DA RESERVA';
  const receipt = safeHttps(booking.paymentReceiptUrl);
  const siteUrl = safeSiteUrl(runtimeValue('NEXT_PUBLIC_SITE_URL'));
  const primaryUrl = isOwner ? (siteUrl ? `${siteUrl}/admin` : '') : (managementUrl || siteUrl);
  const primaryLabel = isOwner ? 'Abrir painel administrativo' : (managementUrl ? 'Gerenciar minha reserva' : 'Visitar o site');
  const notes = isOwner && booking.notes ? `<tr><td style="padding:12px 0;color:#776b60;font-size:13px;border-bottom:1px solid #eadfce">Observações</td><td style="padding:12px 0 12px 16px;text-align:right;color:#211914;font-size:13px;border-bottom:1px solid #eadfce">${escapeHtml(booking.notes)}</td></tr>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#eee8df;font-family:Arial,Helvetica,sans-serif;color:#211914">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(content.clientSubject)} · ${escapeHtml(booking.id)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eee8df"><tr><td align="center" style="padding:28px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf2;border:1px solid #dfd2c0">
        <tr><td style="padding:26px 32px;background:#17120f;color:#f6f0e7;border-bottom:3px solid #cda75d">
          <div style="font-size:15px;letter-spacing:4px;font-weight:700">SÁVIA <span style="color:#cda75d">ARAÚJO</span></div>
          <div style="margin-top:7px;font-size:10px;letter-spacing:2px;color:#b9aa9b">MAKEUP ARTIST · PERNAMBUCO E REGIÃO</div>
        </td></tr>
        <tr><td style="padding:34px 32px 12px">
          <div style="font-size:10px;letter-spacing:1.7px;font-weight:700;color:#a57827">${badge}</div>
          <h1 style="margin:12px 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.05;font-weight:400">${escapeHtml(title)}</h1>
          <p style="margin:0;color:#62574e;font-size:14px;line-height:1.7">${escapeHtml(intro)}</p>
        </td></tr>
        <tr><td style="padding:20px 32px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #eadfce">
            ${row('Reserva', booking.id)}
            ${row('Experiência', booking.serviceLabel)}
            ${row('Data e horário', `${formatDate(booking.appointmentDate)} · ${booking.appointmentTime}`)}
            ${isOwner ? row('Cliente', booking.clientName) : ''}
            ${isOwner ? row('WhatsApp', booking.whatsapp) : ''}
            ${isOwner && booking.email ? row('E-mail', booking.email) : ''}
            ${showPayment ? row('Valor do serviço', money(booking.priceCents)) : ''}
            ${showPayment ? row('Valor recebido', money(paid), true) : ''}
            ${showPayment ? row(balance > 0 ? 'Saldo pendente' : 'Situação', balance > 0 ? money(balance) : 'Integralmente pago', balance > 0) : ''}
            ${showPayment ? row('Forma escolhida', booking.paymentOption === 'deposit' ? 'Sinal de 50%' : 'Valor integral') : ''}
            ${isOwner && booking.paymentId ? row('Transação', booking.paymentId) : ''}
            ${notes}
          </table>
        </td></tr>
        ${showPayment && balance > 0 ? `<tr><td style="padding:0 32px 22px"><div style="padding:16px 18px;background:#f4ead7;border-left:3px solid #cda75d;color:#5d4b2d;font-size:13px;line-height:1.6"><strong>Atenção ao saldo:</strong> foram pagos ${money(paid)}. O restante de <strong>${money(balance)}</strong> não foi cobrado nesta transação e deverá ser quitado posteriormente.</div></td></tr>` : ''}
        ${(primaryUrl || receipt) ? `<tr><td style="padding:2px 32px 32px">${primaryUrl ? button(primaryUrl, primaryLabel) : ''}${receipt ? ` <a href="${escapeAttribute(receipt)}" style="display:inline-block;margin:7px 0 0 8px;color:#806021;font-size:12px">Ver comprovante</a>` : ''}</td></tr>` : ''}
        <tr><td style="padding:22px 32px;background:#211914;color:#bfb1a4;font-size:11px;line-height:1.6">Mensagem automática referente à reserva ${escapeHtml(booking.id)}.<br>Em caso de dúvida, responda este e-mail.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

function emailTitle(booking: Booking, kind: NotificationKind, owner: boolean) {
  if (kind === 'payment_approved') return owner ? 'Nova venda confirmada.' : 'Seu horário está confirmado.';
  if (kind === 'balance_received') return openBalance(booking) > 0 ? 'Novo pagamento registrado.' : 'Pagamento concluído.';
  if (kind === 'booking_created') return owner ? 'Nova solicitação recebida.' : `Recebemos sua solicitação, ${booking.clientName.split(' ')[0]}.`;
  if (kind === 'reminder_48h') return 'Seu atendimento está chegando.';
  if (kind === 'reminder_24h') return 'É amanhã.';
  if (kind === 'rescheduled') return 'Nova data confirmada.';
  return 'Cancelamento registrado.';
}

function row(label: string, value: string, highlight = false) {
  return `<tr><td style="padding:12px 0;color:#776b60;font-size:13px;border-bottom:1px solid #eadfce">${escapeHtml(label)}</td><td style="padding:12px 0 12px 16px;text-align:right;color:${highlight ? '#9a6d1d' : '#211914'};font-size:13px;font-weight:${highlight ? '700' : '400'};border-bottom:1px solid #eadfce">${escapeHtml(value)}</td></tr>`;
}

function button(url: string, label: string) {
  return `<a href="${escapeAttribute(url)}" style="display:inline-block;padding:14px 20px;background:#211914;color:#fffaf2;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.8px">${escapeHtml(label)}</a>`;
}

function paidTotal(booking: Booking) { return Math.max(0, (booking.paymentStatus === 'pago' ? booking.paymentAmountCents : 0) + booking.balancePaidCents); }
function openBalance(booking: Booking) { return Math.max(0, booking.priceCents - paidTotal(booking)); }
function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character); }
function escapeAttribute(value: string) { return escapeHtml(value); }
function safeHttps(value: string | null) { try { const url = value ? new URL(value) : null; return url?.protocol === 'https:' ? url.toString() : ''; } catch { return ''; } }
function safeSiteUrl(value: string) { try { const url = value ? new URL(value) : null; return url && ['https:', 'http:'].includes(url.protocol) ? url.origin : ''; } catch { return ''; } }

async function sign(payload: string, secret: string) {
  if (!secret) return '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
