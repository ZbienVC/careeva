/**
 * /api/screenshots?key=... — serve a worker screenshot from the shared volume.
 * Keys are namespaced screenshots/<userId>/..., and only the owner can read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { getFile } from '@/lib/storage';

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const key = request.nextUrl.searchParams.get('key') || '';
  if (!key.startsWith(`screenshots/${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const data = await getFile(key);
    return new NextResponse(new Uint8Array(data), { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' } });
  } catch {
    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  }
}
