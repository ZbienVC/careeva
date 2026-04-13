import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { aggregateJobSearch } from '@/lib/job-search';
import { prisma } from '@/lib/prisma';

// POST /api/jobs/search — trigger multi-source job search
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));

    // Build queries from user's job preferences if not provided
    let queries: string[] = body.queries || [];
    if (queries.length === 0) {
      const prefs = await prisma.jobPreferences.findUnique({ where: { userId: user.id } });
      const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
      queries = [
        ...(prefs?.targetTitles || []),
        ...(prefs?.targetFunctions || []),
        profile?.jobTitle ? [profile.jobTitle] : [],
      ].flat().filter(Boolean).slice(0, 5);

      if (queries.length === 0) {
        // Fallback: use work history titles
        const wh = await prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' }, take: 2 });
        queries = wh.map(w => w.title).filter(Boolean);
      }
      if (queries.length === 0) return NextResponse.json({ error: 'Add target job titles in your profile to enable job search' }, { status: 400 });
    }

    const sources = body.sources || ['remotive', 'themuse', 'weworkremotely', 'greenhouse'];
    const locations = body.locations || ['United States'];
    const greenhouseBoards = body.greenhouseBoards || [];
    const leverBoards = body.leverBoards || [];

    const result = await aggregateJobSearch({
      userId: user.id,
      queries,
      locations,
      sources,
      greenhouseBoards,
      leverBoards,
    });

    return NextResponse.json({ success: true, ...result, queries, sources });
  } catch (err) {
    console.error('Job search error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 });
  }
}
