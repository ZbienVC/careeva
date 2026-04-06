import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { buildApplicationPacket, autoApplyToJob } from '@/lib/auto-apply';

// POST /api/jobs/[id]/apply
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobId = params.id;
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || 'review_first'; // 'auto' | 'prep_only' | 'review_first'

  try {
    const result = await autoApplyToJob(user.id, jobId, mode);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Auto-apply error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Apply failed' }, { status: 500 });
  }
}

// GET /api/jobs/[id]/apply — preview the application packet without submitting
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const packet = await buildApplicationPacket(user.id, params.id);
    return NextResponse.json(packet);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
