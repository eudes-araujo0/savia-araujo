import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import BookingFlow from './booking-flow';

export const metadata: Metadata = {
  title: 'Agendar horário | Sávia Araújo',
  description: 'Escolha sua experiência de maquiagem, data e horário.',
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string; payment?: string; booking?: string; token?: string; payment_id?: string; collection_id?: string; transaction_nsu?: string; slug?: string; receipt_url?: string; provider?: string }> }) {
  const params = await searchParams;
  const stored = (await cookies()).get('savia_manage')?.value || '';
  const [storedBooking, storedToken] = stored.split('.', 2);
  const initialToken = params.token || (params.booking && storedBooking === params.booking ? storedToken : '') || '';
  return <BookingFlow initialService={params.service || ''} initialPayment={params.payment || ''} initialBooking={params.booking || ''} initialToken={initialToken} initialPaymentId={params.payment_id || params.collection_id || ''} initialTransactionNsu={params.transaction_nsu || ''} initialSlug={params.slug || ''} initialReceiptUrl={params.receipt_url || ''} />;
}
