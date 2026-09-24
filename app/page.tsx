import { listPublicSiteMedia } from '../db/media';
import { listServices } from '../db/services';
import { BOOKABLE_SERVICES } from '../lib/service-catalog';
import HomeClient from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [initialMedia, initialServices] = await Promise.all([
    listPublicSiteMedia().catch(() => []),
    listServices().catch(() => BOOKABLE_SERVICES),
  ]);
  return <HomeClient initialMedia={initialMedia} initialServices={initialServices} />;
}
