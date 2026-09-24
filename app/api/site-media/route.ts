import { NextResponse } from 'next/server';
import { listPublicSiteMedia } from '../../../db/media';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const media = await listPublicSiteMedia();
    return NextResponse.json({ media }, { headers: { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ media: [] }, { headers: { 'cache-control': 'no-store' } });
  }
}
