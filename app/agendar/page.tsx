import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import BookingFlow from './booking-flow';
import { listPublicSiteMedia } from '../../db/media';
import { listServices } from '../../db/services';
import { getBusinessSchedule } from '../../db/schedule';
import { BOOKABLE_SERVICES } from '../../lib/service-catalog';

export const metadata: Metadata = {
  title: 'Agendar horário | Sávia Araújo',
  description: 'Escolha sua experiência de maquiagem, data e horário.',
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string; payment?: string; booking?: string; token?: string; transaction_nsu?: string; slug?: string; receipt_url?: string }> }) {
  const params = await searchParams;
  const stored = (await cookies()).get('savia_manage')?.value || '';
  const [storedBooking, storedToken] = stored.split('.', 2);
  const initialToken = params.token || (params.booking && storedBooking === params.booking ? storedToken : '') || '';
  const [initialMedia, initialServices, initialSchedule] = await Promise.all([
    listPublicSiteMedia().catch(() => []),
    listServices().catch(() => BOOKABLE_SERVICES),
    getBusinessSchedule(),
  ]);
  return <BookingFlow initialMedia={initialMedia} initialServices={initialServices} initialSchedule={initialSchedule} initialService={params.service || ''} initialPayment={params.payment || ''} initialBooking={params.booking || ''} initialToken={initialToken} initialTransactionNsu={params.transaction_nsu || ''} initialSlug={params.slug || ''} initialReceiptUrl={params.receipt_url || ''} />;
}
