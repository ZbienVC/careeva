/**
 * app/api/cron/sync/route.ts
 *
 * Scheduled job sync endpoint.
 * Call this from Railway's cron: POST /api/cron/sync
 * with header: Authorization: Bearer {CRON_SECRET}
 *
 * Recommended Railway cron: every 6 hours
 * Command: curl -X POST https://your-app.railway.app/api/cron/sync \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runJobSync, cleanupStaleJobs, TOP_GREENHOUSE_BOARDS, TOP_LEVER_BOARDS, TOP_ASHBY_BOARDS } from '@/lib/job-connectors';
import { scoreJob } from '@/lib/job-scorer';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (CRON_SECRET && token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const log: string[] = [];
  const allStats = { staleDeactivated: 0, newJobs: 0, scored: 0, errors: 0 };

  try {
    // Get all users with job preferences configured
    const users = await prisma.user.findMany({
      where: {
        jobPreferences: { isNot: null },
      },
      select: {
        id: true,
        email: true,
        jobPreferences: {
          select: { targetTitles: true, remotePreference: true },
        },
      },
    });

    log.push('Cron sync started for ' + users.length + ' users');

    for (const user of users) {
      try {
        // Cleanup stale jobs
        const stale = await cleanupStaleJobs(user.id);
        allStats.staleDeactivated += stale;

        // Sync all boards
        const boardSources = [
          ...TOP_GREENHOUSE_BOARDS.map(s => ({ type: 'greenhouse' as const, slug: s })),
          ...TOP_LEVER_BOARDS.map(s => ({ type: 'lever' as const, slug: s })),
          ...TOP_ASHBY_BOARDS.map(s => ({ type: 'ashby' as const, slug: s })),
        ];

        const syncResult = await runJobSync(user.id, boardSources);
        allStats.newJobs += syncResult.totalNew;
        log.push('User ' + user.id + ': +' + syncResult.totalNew + ' new jobs, -' + stale + ' stale');

        // Auto-score new jobs
        const [profile, skills, jobPrefs, workHistory] = await Promise.all([
          prisma.userProfile.findUnique({ where: { userId: user.id } }),
          prisma.skill.findMany({ where: { userId: user.id } }),
          prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
          prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' } }),
        ]);

        let yearsExp = 0;
        if (workHistory.length > 0) {
          const earliest = workHistory[workHistory.length - 1]?.startDate;
          if (earliest) yearsExp = Math.floor((Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24 * 365));
        }

        const scoringProfile = {
          skills: [...new Set([...(profile?.skills || []), ...skills.map(s => s.name), ...workHistory.flatMap(w => w.skills || [])])],
          roles: [...new Set([...(profile?.roles || []), ...(jobPrefs?.targetTitles || [])])],
          industries: [...new Set([...(profile?.industries || []), ...(jobPrefs?.targetIndustries || [])])],
          yearsExperience: yearsExp || profile?.yearsExperience || 0,
          education: profile?.education || [],
          technologies: [...new Set([...(profile?.technologies || []), ...workHistory.flatMap(w => w.technologies || [])])],
          targetTitles: jobPrefs?.targetTitles || [],
          targetIndustries: jobPrefs?.targetIndustries || [],
          roleFamilies: jobPrefs?.roleFamilies || [],
          salaryMin: jobPrefs?.salaryMinUSD || undefined,
          salaryMax: jobPrefs?.salaryMaxUSD || undefined,
          remotePreference: jobPrefs?.remotePreference || undefined,
          preferredLocations: jobPrefs?.preferredLocations || [],
        };

        const unscoredJobs = await prisma.job.findMany({
          where: { userId: user.id, isActive: true, jobScores: { none: {} } },
          take: 200,
        });

        for (const job of unscoredJobs) {
          try {
            const result = scoreJob(scoringProfile, {
              title: job.title, description: job.description, requirements: job.requirements,
              salaryMin: job.salaryMin || undefined, salaryMax: job.salaryMax || undefined,
              isRemote: job.isRemote || false, isHybrid: job.isHybrid || false,
              location: job.location || undefined, roleFamilies: job.roleFamilies || [],
              atsType: job.atsType || undefined,
            });
            await prisma.jobScore.create({
              data: {
                userId: user.id, jobId: job.id,
                score: result.score, overallScore: result.overallScore,
                reasoning: result.reasoning, recommendation: result.recommendation,
                skillScore: result.skillScore, roleScore: result.roleScore,
                locationScore: result.locationScore, compensationScore: result.compensationScore,
              },
            });
            allStats.scored++;
          } catch { allStats.errors++; }
        }
      } catch (userErr) {
        allStats.errors++;
        log.push('Error for user ' + user.id + ': ' + (userErr instanceof Error ? userErr.message : String(userErr)));
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log.push('Done in ' + elapsed + 's: ' + allStats.newJobs + ' new jobs, ' + allStats.scored + ' scored, ' + allStats.staleDeactivated + ' deactivated');

    return NextResponse.json({ success: true, stats: allStats, log, elapsed });

  } catch (err) {
    console.error('Cron sync error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Cron failed', log }, { status: 500 });
  }
}

// GET - last sync status
export async function GET() {
  const recentRuns = await prisma.scrapeRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { userId: true, status: true, jobsNew: true, completedAt: true, source: true },
  });
  return NextResponse.json({ recentRuns });
}
