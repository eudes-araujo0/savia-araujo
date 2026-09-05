import type { Metadata } from 'next';
import DemoPayment from './payment-demo';

export const metadata: Metadata = { title: 'Demonstração de pagamento | Sávia Araújo', robots: { index: false, follow: false } };

export default async function DemoPaymentPage({ searchParams }: { searchParams: Promise<{ booking?: string; token?: string; manage?: string }> }) {
  const params = await searchParams;
  return <DemoPayment booking={params.booking || ''} token={params.token || ''} managementToken={params.manage || ''} />;
}
