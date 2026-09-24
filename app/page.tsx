import { listSiteMedia } from '../db/media';
import HomeClient from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialMedia = await listSiteMedia().catch(() => []);
  return <HomeClient initialMedia={initialMedia} />;
}
