import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { getProfileCompleteness } from '@/lib/profile-completeness';

// GET /api/profile/completeness — what real data is present vs missing
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const completeness = await getProfileCompleteness(user.id);
    return NextResponse.json(completeness);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute completeness' },
      { status: 500 }
    );
  }
}
