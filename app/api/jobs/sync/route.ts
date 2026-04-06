import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { aggregateJobSearch } from '@/lib/job-search';
import { runJobSync } from '@/lib/job-connectors';
import { prisma } from '@/lib/db';

// POST /api/jobs/sync — trigger a full job sync from user's JobPreferences
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));

    // Load user's job preferences + skills to build intelligent search queries
    const [prefs, skills, workHistory, companyTargets] = await Promise.all([
      prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
      prisma.skill.findMany({ where: { userId: user.id }, take: 20 }),
      prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' }, take: 3 }),
      prisma.companyTarget.findMany({ where: { userId: user.id }, take: 20 }),
    ]);

    // Build search queries from profile data
    const queries: string[] = [];

    // Primary: target titles from job preferences
    if (prefs?.targetTitles?.length) {
      queries.push(...prefs.targetTitles.slice(0, 3));
    }

    // Fallback: infer from work history titles
    if (queries.length === 0 && workHistory.length > 0) {
      queries.push(workHistory[0].title);
      if (workHistory[1]) queries.push(workHistory[1].title);
    }

    // Skill-based queries for hard-to-title roles
    if (queries.length < 3 && skills.length > 0) {
      const topSkills = skills.slice(0, 3).map(s => s.name).join(' ');
      queries.push(`${topSkills} developer`);
    }

    // Deduplicate and limit
    const uniqueQueries = [...new Set(queries)].slice(0, 5);

    if (uniqueQueries.length === 0) {
      return NextResponse.json(
        { error: 'No search queries could be built. Complete your profile (job preferences or work history) first.' },
        { status: 400 }
      );
    }

    // Build locations from preferences
    const locations: string[] = prefs?.preferredLocations?.length
      ? prefs.preferredLocations.slice(0, 3)
      : ['United States'];

    // Add remote if preferred
    if (prefs?.remotePreference === 'remote_only' || prefs?.remotePreference === 'any') {
      if (!locations.includes('remote')) locations.unshift('remote');
    }

    // Choose sources (can be overridden in body)
    const sources: string[] = body.sources || [
      'google', 'remotive', 'adzuna', 'themuse', 'arbeitnow',
      'weworkremotely', 'authenticjobs', 'indeed', 'dice',
    ];

    // Build Greenhouse/Lever boards from company targets
    const greenhouseBoards: string[] = [];
    const leverBoards: string[] = [];

    for (const ct of companyTargets) {
      if (ct.atsType === 'greenhouse' && ct.atsSlug) greenhouseBoards.push(ct.atsSlug);
      if (ct.atsType === 'lever' && ct.atsSlug) leverBoards.push(ct.atsSlug);
    }

    // Add well-known boards for target industries
    if (prefs?.targetIndustries?.some(i => /crypto|web3|blockchain/i.test(i))) {
      greenhouseBoards.push('coinbase', 'consensys', 'chainalysis', 'anchorage');
      leverBoards.push('paradigm', 'a16zcrypto');
    }
    if (prefs?.targetIndustries?.some(i => /fintech|finance/i.test(i))) {
      greenhouseBoards.push('stripe', 'brex', 'plaid', 'robinhood');
      leverBoards.push('chime', 'mercury');
    }
    if (prefs?.targetFunctions?.some(f => /data|analytics|ml|ai/i.test(f))) {
      greenhouseBoards.push('databricks', 'snowflake', 'dbt-labs');
      leverBoards.push('amplitude', 'mixpanel', 'fivetran');
    }

    // Run the search
    const result = await aggregateJobSearch({
      userId: user.id,
      queries: uniqueQueries,
      locations,
      sources,
      greenhouseBoards: [...new Set(greenhouseBoards)],
      leverBoards: [...new Set(leverBoards)],
    });

    return NextResponse.json({
      success: true,
      queriesUsed: uniqueQueries,
      locationsUsed: locations,
      sourcesUsed: sources,
      greenhouseBoards: [...new Set(greenhouseBoards)],
      leverBoards: [...new Set(leverBoards)],
      ...result,
    });

  } catch (err) {
    console.error('Job sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET /api/jobs/sync — list recent scrape runs + last sync summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [runs, prefs] = await Promise.all([
    prisma.scrapeRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
  ]);

  const lastSync = runs[0] ?? null;
  const queriesPreview = prefs?.targetTitles?.slice(0, 3) ?? [];

  return NextResponse.json({ runs, lastSync, queriesPreview });
}
