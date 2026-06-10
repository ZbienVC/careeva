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
import { aggregateJobSearch, getAvailableSources } from '@/lib/job-search';
import { scoreJob } from '@/lib/job-scorer';
import { parseRelocationScope, canonicalCountry } from '@/lib/geo';
import { enqueueApplyTask } from '@/lib/apply-queue';
import { sendDailyDigest } from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // Verify cron secret — REQUIRED. Previously this endpoint ran open when
  // CRON_SECRET was unset; now it refuses instead.
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured on the server — set it before enabling scheduled sync.' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const log: string[] = [];
  const allStats = { staleDeactivated: 0, newJobs: 0, scored: 0, autoQueued: 0, errors: 0 };

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
          select: { targetTitles: true, remotePreference: true, preferredLocations: true, willingToRelocate: true, relocationNote: true },
        },
        personalInfo: {
          select: { city: true, state: true, country: true },
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
        let userNewJobs = syncResult.totalNew;
        allStats.newJobs += syncResult.totalNew;
        log.push('User ' + user.id + ': +' + syncResult.totalNew + ' new jobs from boards, -' + stale + ' stale');

        // Multi-source aggregator (env-driven sources), keyed off the user's target titles
        const titles: string[] = Array.isArray(user.jobPreferences?.targetTitles)
          ? (user.jobPreferences.targetTitles as string[]).slice(0, 3)
          : [];
        if (titles.length > 0) {
          try {
            const homeBase = [user.personalInfo?.city, user.personalInfo?.state].filter(Boolean).join(', ');
            const userLocations: string[] = user.jobPreferences?.preferredLocations?.length
              ? user.jobPreferences.preferredLocations
              : homeBase ? [homeBase] : ['United States'];
            const scope = parseRelocationScope(user.jobPreferences?.relocationNote, user.jobPreferences?.willingToRelocate);
            const agg = await aggregateJobSearch({
              userId: user.id,
              queries: [...new Set(titles)],
              locations: userLocations,
              sources: getAvailableSources(),
              userCountry: canonicalCountry(user.personalInfo?.country),
              allowInternational: scope === 'international',
            });
            userNewJobs += agg.new;
            allStats.newJobs += agg.new;
            log.push('User ' + user.id + ': +' + agg.new + ' new jobs from aggregator');
          } catch (aggErr) {
            log.push('User ' + user.id + ' aggregator error: ' + (aggErr instanceof Error ? aggErr.message : String(aggErr)));
          }
        }

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
          skills: [...new Set([...(profile?.skills || []), ...skills.map((s: any) => s.name), ...workHistory.flatMap((w: any) => w.skills || [])])],
          roles: [...new Set([...(profile?.roles || []), ...(jobPrefs?.targetTitles || [])])],
          industries: [...new Set([...(profile?.industries || []), ...(jobPrefs?.targetIndustries || [])])],
          yearsExperience: yearsExp || profile?.yearsExperience || 0,
          education: profile?.education || [],
          technologies: [...new Set([...(profile?.technologies || []), ...workHistory.flatMap((w: any) => w.technologies || [])])],
          targetTitles: jobPrefs?.targetTitles || [],
          targetIndustries: jobPrefs?.targetIndustries || [],
          roleFamilies: jobPrefs?.roleFamilies || [],
          salaryMin: jobPrefs?.salaryMinUSD || undefined,
          salaryMax: jobPrefs?.salaryMaxUSD || undefined,
          remotePreference: jobPrefs?.remotePreference || undefined,
          preferredLocations: jobPrefs?.preferredLocations || [],
          country: canonicalCountry(user.personalInfo?.country),
          willingToRelocate: jobPrefs?.willingToRelocate ?? profile?.willingToRelocate ?? false,
          relocationScope: parseRelocationScope(jobPrefs?.relocationNote, jobPrefs?.willingToRelocate ?? profile?.willingToRelocate),
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

        // ── Fully-automatic applying (user opt-in: Settings → daily runs) ──
        // Finds the best-scoring unapplied jobs and queues them for the apply
        // worker. enqueueApplyTask enforces every gate the user configured
        // (blacklists, whitelist, daily cap, duplicates, fillable-form check),
        // and the worker adds the perfect-fill + trust-ramp gates on top.
        let queuedThisRun = 0;
        const autoConfig = await prisma.autoApplyConfig.findUnique({ where: { userId: user.id } });
        if (autoConfig?.autoApplyEnabled) {
          const gate = autoConfig.minScoreToApply ?? 65;
          const perRunCap = Math.min(autoConfig.maxAppliesPerRun || 10, 15);
          const candidates = await prisma.job.findMany({
            where: {
              userId: user.id,
              isActive: true,
              jobScores: { some: { userId: user.id, overallScore: { gte: gate } } },
              applications: { none: { userId: user.id } },
            },
            include: { jobScores: { where: { userId: user.id }, orderBy: { overallScore: 'desc' }, take: 1 } },
            take: 100,
          });
          candidates.sort((a, b) => (b.jobScores[0]?.overallScore || 0) - (a.jobScores[0]?.overallScore || 0));

          for (const job of candidates) {
            if (queuedThisRun >= perRunCap) break;
            try {
              const enq = await enqueueApplyTask(user.id, job.id);
              if (enq.taskId && !enq.blocked) queuedThisRun++;
              else if (enq.status === 'blocked_daily_limit') break; // no point trying more today
            } catch { allStats.errors++; }
          }
          allStats.autoQueued += queuedThisRun;
          if (queuedThisRun > 0) log.push('User ' + user.id + ': auto-queued ' + queuedThisRun + ' applications');
        }

        // ── Daily digest (skipped silently when SMTP isn't configured) ──
        if (user.email) {
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const [awaitingApproval, submittedToday] = await Promise.all([
            prisma.applyTask.count({ where: { userId: user.id, status: 'awaiting_approval' } }),
            prisma.applyTask.count({ where: { userId: user.id, status: 'submitted', submittedAt: { gte: dayStart } } }),
          ]);
          if (queuedThisRun > 0 || awaitingApproval > 0 || submittedToday > 0) {
            await sendDailyDigest(user.email, {
              newJobs: userNewJobs,
              queued: queuedThisRun,
              awaitingApproval,
              submittedToday,
            }).catch(() => {});
          }
        }
      } catch (userErr) {
        allStats.errors++;
        log.push('Error for user ' + user.id + ': ' + (userErr instanceof Error ? userErr.message : String(userErr)));
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log.push('Done in ' + elapsed + 's: ' + allStats.newJobs + ' new jobs, ' + allStats.scored + ' scored, ' + allStats.autoQueued + ' auto-queued, ' + allStats.staleDeactivated + ' deactivated');

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
