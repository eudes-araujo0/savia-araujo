import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getManagedBooking } from '../../../db/bookings';
import ReservationManager from './reservation-manager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gerenciar reserva | Sávia Araújo', robots: { index: false, follow: false } };

export default async function ReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = query.token || '';
  const booking = await getManagedBooking(id, token);
  if (!booking) notFound();
  return <ReservationManager token={token} initialBooking={{ id: booking.id, clientName: booking.clientName, whatsapp: booking.whatsapp, service: booking.service, serviceLabel: booking.serviceLabel, appointmentDate: booking.appointmentDate, appointmentTime: booking.appointmentTime, status: booking.status, paymentStatus: booking.paymentStatus, paymentProvider: booking.paymentProvider, priceCents: booking.priceCents, paymentAmountCents: booking.paymentAmountCents, balancePaidCents: booking.balancePaidCents, paymentOption: booking.paymentOption, expiresAt: booking.expiresAt }} />;
}
