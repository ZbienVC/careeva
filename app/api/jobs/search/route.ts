import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { aggregateJobSearch, CURATED_GREENHOUSE_BOARDS, CURATED_LEVER_BOARDS } from '@/lib/job-search';
import { prisma } from '@/lib/prisma';

// Zach's personal fallback profile (used when JobPreferences not yet configured)
const ZACH_FALLBACK = {
  targetTitles: [
    'Software Engineer',
    'Full Stack Engineer',
    'Senior Software Engineer',
    'Product Engineer',
    'AI Engineer',
  ],
  targetIndustries: ['Technology', 'AI', 'Fintech', 'Crypto / Web3', 'Startup'],
  targetFunctions: ['Engineering', 'Product', 'AI'],
  remotePreference: 'remote_only',
};

// POST /api/jobs/search - trigger multi-source job search
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

    // Build search queries - profile > work history > Zach fallback
    let queries: string[] = body.queries || [];

    if (queries.length === 0) {
      if (prefs?.targetTitles?.length) {
        // targetTitles stored as array or comma-string
        const titles = Array.isArray(prefs.targetTitles)
          ? prefs.targetTitles
          : String(prefs.targetTitles).split(',').map((s: string) => s.trim()).filter(Boolean);
        queries = titles.slice(0, 4);
      }

      if (queries.length === 0 && workHistory.length > 0) {
        queries = workHistory.slice(0, 2).map(w => w.title).filter(Boolean);
      }

      // Always fall back to Zach's profile if nothing configured yet
      if (queries.length === 0) {
        queries = ZACH_FALLBACK.targetTitles.slice(0, 3);
      }
    }

    // Deduplicate
    queries = [...new Set(queries)].slice(0, 5);

    // Source selection - curated tech/startup sources only, no broad retail boards
    type JobSource = 'google'|'remotive'|'adzuna'|'themuse'|'greenhouse'|'lever'|'indeed'|'weworkremotely'|'monster'|'remoteco'|'usajobs'|'arbeitnow'|'authenticjobs'|'jsearch'|'dice';
    const sources: JobSource[] = (body.sources || [
      'remotive',    // Remote tech jobs, well-filtered
      'themuse',     // Curated companies, good quality
      'greenhouse',  // Direct ATS boards - best quality
      'lever',       // Direct ATS boards - best quality
    ]) as JobSource[];

    // Location - remote first for tech roles
    const locations = body.locations || ['United States'];

    // Build curated Greenhouse/Lever boards based on profile
    const allIndustries = [
      ...(Array.isArray(prefs?.targetIndustries) ? prefs.targetIndustries : []),
      ...ZACH_FALLBACK.targetIndustries,
    ].map(i => i.toLowerCase());

    const allFunctions = [
      ...(Array.isArray(prefs?.targetFunctions) ? prefs.targetFunctions : []),
      ...ZACH_FALLBACK.targetFunctions,
    ].map(f => f.toLowerCase());

    const skillNames = skills.map(s => s.name.toLowerCase());

    const greenhouseBoards: string[] = [];
    const leverBoards: string[] = [];

    // Always include top tech/startup boards
    greenhouseBoards.push(...(CURATED_GREENHOUSE_BOARDS.startup || []), ...(CURATED_GREENHOUSE_BOARDS.ai_ml || []));
    leverBoards.push(...(CURATED_LEVER_BOARDS.startup || []), ...(CURATED_LEVER_BOARDS.engineering || []));

    // Add industry-specific boards
    if (allIndustries.some(i => /crypto|web3|blockchain/.test(i))) {
      greenhouseBoards.push(...(CURATED_GREENHOUSE_BOARDS.crypto || []));
    }
    if (allIndustries.some(i => /fintech|finance|payments/.test(i))) {
      greenhouseBoards.push(...(CURATED_GREENHOUSE_BOARDS.fintech || []));
    }
    if (allFunctions.some(f => /data|analytic|ml|ai/.test(f)) || skillNames.some(s => /sql|python|data/.test(s))) {
      greenhouseBoards.push(...(CURATED_GREENHOUSE_BOARDS.analytics || []));
      leverBoards.push(...(CURATED_LEVER_BOARDS.analytics || []));
    }

    const result = await aggregateJobSearch({
      userId: user.id,
      queries,
      locations,
      sources,
      greenhouseBoards: [...new Set(greenhouseBoards)].slice(0, 20),
      leverBoards: [...new Set(leverBoards)].slice(0, 20),
    });

    return NextResponse.json({
      success: true,
      queriesUsed: queries,
      sourcesUsed: sources,
      ...result,
    });
  } catch (err) {
    console.error('Job search error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 });
  }
}
