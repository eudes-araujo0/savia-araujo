import type { Booking } from '../db/schema';
import { finishNotification, reserveNotification } from '../db/bookings';
import { runtimeValue } from './runtime-env';

export type NotificationKind = 'booking_created' | 'payment_approved' | 'reminder_48h' | 'reminder_24h' | 'rescheduled' | 'cancelled';

export async function notifyBooking(booking: Booking, kind: NotificationKind, managementUrl = '') {
  const webhookUrl = runtimeValue('NOTIFICATION_WEBHOOK_URL');
  const resendKey = runtimeValue('RESEND_API_KEY');
  const ownerEmail = runtimeValue('NOTIFICATION_OWNER_EMAIL');
  if (!webhookUrl && !resendKey) return { delivered: false, configured: false };

  const deliveryId = await reserveNotification(booking.id, kind);
  if (!deliveryId) return { delivered: true, configured: true, duplicate: true };

  const content = notificationContent(booking, kind, managementUrl);
  const payload = {
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
      amountCents: booking.paymentAmountCents,
      paymentOption: booking.paymentOption,
      managementUrl,
    },
    messages: content,
  };

  const attempts: Promise<Response>[] = [];
  if (webhookUrl) {
    const serialized = JSON.stringify(payload);
    attempts.push(fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-savia-signature': await sign(serialized, runtimeValue('NOTIFICATION_WEBHOOK_SECRET')),
      },
      body: serialized,
      signal: AbortSignal.timeout(8000),
    }));
  }
  if (resendKey && booking.email) {
    attempts.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: runtimeValue('NOTIFICATION_FROM_EMAIL') || 'Sávia Araújo <agendamento@resend.dev>',
        to: [booking.email],
        subject: content.subject,
        text: content.client,
      }),
      signal: AbortSignal.timeout(8000),
    }));
  }
  if (resendKey && ownerEmail) {
    attempts.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: runtimeValue('NOTIFICATION_FROM_EMAIL') || 'Sávia Araújo <agendamento@resend.dev>',
        to: [ownerEmail],
        subject: `[Agenda] ${content.subject}`,
        text: content.owner,
      }),
      signal: AbortSignal.timeout(8000),
    }));
  }

  try {
    const responses = await Promise.allSettled(attempts);
    const delivered = responses.some((result) => result.status === 'fulfilled' && result.value.ok);
    const error = responses.map((result) => result.status === 'rejected' ? result.reason instanceof Error ? result.reason.message : 'Falha de rede' : result.value.ok ? '' : `HTTP ${result.value.status}`).filter(Boolean).join('; ');
    await finishNotification(deliveryId, delivered, error);
    return { delivered, configured: true };
  } catch (error) {
    await finishNotification(deliveryId, false, error instanceof Error ? error.message : 'Falha ao enviar notificação');
    return { delivered: false, configured: true };
  }
}

function notificationContent(booking: Booking, kind: NotificationKind, managementUrl: string) {
  const date = formatDate(booking.appointmentDate);
  const manage = managementUrl ? `\n\nGerencie sua reserva: ${managementUrl}` : '';
  const address = runtimeValue('BUSINESS_ADDRESS');
  const location = address ? ` Local: ${address}.` : '';
  const content: Record<NotificationKind, { subject: string; client: string; owner: string }> = {
    booking_created: {
      subject: 'Recebemos sua solicitação de agendamento',
      client: `Olá, ${booking.clientName}! Recebemos sua solicitação para ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}. O horário fica pré-reservado por 30 minutos enquanto você conclui o pagamento.${manage}`,
      owner: `Nova solicitação: ${booking.clientName}, ${booking.serviceLabel}, ${date} às ${booking.appointmentTime}.`,
    },
    payment_approved: {
      subject: 'Pagamento aprovado e reserva confirmada',
      client: `Olá, ${booking.clientName}! Seu pagamento foi aprovado e a reserva de ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}, está confirmada.${manage}`,
      owner: `Pagamento aprovado: ${booking.clientName}, ${booking.serviceLabel}, ${date} às ${booking.appointmentTime}.`,
    },
    reminder_48h: {
      subject: 'Seu atendimento está chegando',
      client: `Olá, ${booking.clientName}! Faltam dois dias para seu atendimento de ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}. Se precisar ajustar algum detalhe, fale conosco.${manage}`,
      owner: `Lembrete de 48h enviado para ${booking.clientName}.`,
    },
    reminder_24h: {
      subject: 'É amanhã: seu atendimento com Sávia Araújo',
      client: `Olá, ${booking.clientName}! Seu atendimento de ${booking.serviceLabel} é amanhã, ${date}, às ${booking.appointmentTime}.${location} Chegue com alguns minutos de antecedência e siga as orientações de preparação combinadas.${manage}`,
      owner: `Lembrete de 24h enviado para ${booking.clientName}.`,
    },
    rescheduled: {
      subject: 'Sua reserva foi reagendada',
      client: `Olá, ${booking.clientName}! Sua reserva foi atualizada para ${date} às ${booking.appointmentTime}.${manage}`,
      owner: `Reserva reagendada: ${booking.clientName}, ${date} às ${booking.appointmentTime}.`,
    },
    cancelled: {
      subject: 'Sua solicitação de cancelamento foi registrada',
      client: `Olá, ${booking.clientName}. Sua reserva de ${booking.serviceLabel}, em ${date} às ${booking.appointmentTime}, foi cancelada. Para informações sobre valores pagos, fale diretamente com Sávia Araújo.`,
      owner: `Reserva cancelada: ${booking.clientName}, ${booking.serviceLabel}, ${date} às ${booking.appointmentTime}.`,
    },
  };
  return content[kind];
}

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
