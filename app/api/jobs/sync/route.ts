import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { runJobSync, cleanupStaleJobs, TOP_GREENHOUSE_BOARDS, TOP_LEVER_BOARDS, TOP_ASHBY_BOARDS } from '@/lib/job-connectors';
import { aggregateJobSearch } from '@/lib/job-search';
import { prisma } from '@/lib/db';

// POST /api/jobs/sync - full ATS board sync + general search
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));

    // Load user preferences
    const [prefs, skills, workHistory] = await Promise.all([
      prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
      prisma.skill.findMany({ where: { userId: user.id }, take: 20 }),
      prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' }, take: 3 }),
    ]);

    // ── Step 1: Cleanup stale jobs ────────────────────────────────────────────
    const staleDeactivated = await cleanupStaleJobs(user.id);

    // ── Step 2: Build board list ──────────────────────────────────────────────
    // Start with top curated boards (50+ companies), always included
    const sources: Array<{ type: 'greenhouse' | 'lever' | 'ashby'; slug: string }> = [
      ...TOP_GREENHOUSE_BOARDS.map(s => ({ type: 'greenhouse' as const, slug: s })),
      ...TOP_LEVER_BOARDS.map(s => ({ type: 'lever' as const, slug: s })),
      ...TOP_ASHBY_BOARDS.map(s => ({ type: 'ashby' as const, slug: s })),
    ];

    // Add any user-specified company targets
    const companyTargets = await prisma.companyTarget.findMany({
      where: { userId: user.id },
      select: { name: true, atsType: true, atsSlug: true },
    }).catch(() => []);

    for (const target of companyTargets) {
      if (target.atsSlug && target.atsType) {
        const type = target.atsType as 'greenhouse' | 'lever' | 'ashby';
        if (!sources.find(s => s.slug === target.atsSlug)) {
          sources.push({ type, slug: target.atsSlug });
        }
      }
    }

    // ── Step 3: Run board sync (parallel, batched) ────────────────────────────
    const syncResult = await runJobSync(user.id, sources);

    // ── Step 4: General search for discovery of NEW companies ─────────────────
    // Build queries from profile
    const profileTitles = Array.isArray(prefs?.targetTitles)
      ? prefs.targetTitles
      : String(prefs?.targetTitles || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    const queries = profileTitles.length > 0
      ? profileTitles.slice(0, 3)
      : workHistory.length > 0
        ? workHistory.slice(0, 2).map(w => w.title).filter(Boolean)
        : ['Software Engineer', 'AI Engineer', 'Full Stack Engineer'];

    const searchResult = await aggregateJobSearch({
      userId: user.id,
      queries: [...new Set(queries)],
      locations: ['United States'],
      sources: ['remotive', 'themuse'],
      greenhouseBoards: [],
      leverBoards: [],
    });

    // ── Count active jobs ─────────────────────────────────────────────────────
    const totalActive = await prisma.job.count({ where: { userId: user.id, isActive: true } });

    return NextResponse.json({
      success: true,
      staleDeactivated,
      boardSync: {
        boardsScanned: sources.length,
        newFromBoards: syncResult.totalNew,
      },
      generalSearch: {
        queriesUsed: queries,
        newFromSearch: searchResult.new,
      },
      totalActiveJobs: totalActive,
    });

  } catch (err) {
    console.error('Job sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET /api/jobs/sync - last sync summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [runs, activeCount, recentJobs] = await Promise.all([
    prisma.scrapeRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, jobsFound: true, jobsNew: true, completedAt: true, source: true },
    }),
    prisma.job.count({ where: { userId: user.id, isActive: true } }),
    prisma.job.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, company: true, source: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    lastRun: runs[0] ?? null,
    totalActiveJobs: activeCount,
    recentJobs,
    boardsAvailable: TOP_GREENHOUSE_BOARDS.length + TOP_LEVER_BOARDS.length + TOP_ASHBY_BOARDS.length,
  });
}
