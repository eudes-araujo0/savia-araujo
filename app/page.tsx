import { listPublicSiteMedia } from '../db/media';
import HomeClient from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialMedia = await listPublicSiteMedia().catch(() => []);
  return <HomeClient initialMedia={initialMedia} />;
}
