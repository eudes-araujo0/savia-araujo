import type { Metadata } from 'next';
import BookingFlow from './booking-flow';

export const metadata: Metadata = {
  title: 'Agendar horário | Sávia Araújo',
  description: 'Escolha sua experiência de maquiagem, data e horário.',
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string; payment?: string; booking?: string }> }) {
  const params = await searchParams;
  return <BookingFlow initialService={params.service || ''} initialPayment={params.payment || ''} initialBooking={params.booking || ''} />;
}
