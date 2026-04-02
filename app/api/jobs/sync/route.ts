import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { runJobSync } from '@/lib/job-connectors';
import { prisma } from '@/lib/db';

// POST /api/jobs/sync â€” trigger a job sync from configured sources
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    
    // Sources can be passed in body or loaded from user's saved config
    // Format: [{ type: "greenhouse", slug: "stripe" }, { type: "lever", slug: "openai" }]
    const sources = body.sources || [];

    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'sources array required. Example: [{"type":"greenhouse","slug":"stripe"}]' },
        { status: 400 }
      );
    }

    const result = await runJobSync(user.id, sources);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Job sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET /api/jobs/sync â€” list recent scrape runs
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const runs = await prisma.scrapeRun.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ runs });
}
