/**
 * /api/automate/route.ts
 *
 * Automation engine - orchestrates the full apply pipeline:
 * 1. Sync all company boards (Greenhouse + Lever + Ashby)
 * 2. Score all unscored jobs
 * 3. Generate application packets for top-scoring jobs
 * 4. Submit to ATS or queue for review
 *
 * Modes:
 *   score_only   - find and score jobs, no applying
 *   prep_all     - generate packets, no submit
 *   auto_safe    - auto-submit where confident (score >= 80), queue rest
 *   full_auto    - submit everything above threshold
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { runJobSync, cleanupStaleJobs, TOP_GREENHOUSE_BOARDS, TOP_LEVER_BOARDS, TOP_ASHBY_BOARDS } from '@/lib/job-connectors';
import { aggregateJobSearch, getAvailableSources } from '@/lib/job-search';
import { autoApplyToJob } from '@/lib/auto-apply';
import { enqueueApplyTask } from '@/lib/apply-queue';
import { scoreJob } from '@/lib/job-scorer';
import { parseRelocationScope, canonicalCountry } from '@/lib/geo';

const DEFAULT_APPLY_THRESHOLD = 50;
const MAX_APPLIES_PER_RUN = 10;

type AutomateMode = 'score_only' | 'prep_all' | 'auto_safe' | 'full_auto';

async function buildScoringProfile(userId: string) {
  const [profile, personalInfo, skills, jobPrefs, workHistory] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
  ]);

  let yearsExp = 0;
  if (workHistory.length > 0) {
    const earliest = workHistory[workHistory.length - 1]?.startDate;
    if (earliest) yearsExp = Math.floor((Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24 * 365));
  }

  return {
    skills: [...new Set([...(profile?.skills || []), ...skills.map((s: any) => s.name), ...workHistory.flatMap((w: any) => w.skills || [])])],
    roles: [...new Set([...(profile?.roles || []), ...(jobPrefs?.targetTitles || [])])],
    industries: [...new Set([...(profile?.industries || []), ...(jobPrefs?.targetIndustries || [])])],
    yearsExperience: yearsExp || profile?.yearsExperience || 0,
    education: profile?.education || [],
    technologies: [...new Set([
      ...(profile?.technologies || []),
      ...workHistory.flatMap((w: any) => w.technologies || []),
      ...skills.filter((s: any) => /python|sql|typescript|javascript|react|node|aws|gcp|docker|kubernetes/i.test(s.name)).map((s: any) => s.name.toLowerCase()),
    ])],
    targetTitles: [
      ...(jobPrefs?.targetTitles || []),
      ...(profile?.jobTitle ? [profile.jobTitle] : []),
    ].filter(Boolean),
    targetIndustries: jobPrefs?.targetIndustries || [],
    roleFamilies: jobPrefs?.roleFamilies || [],
    salaryMin: jobPrefs?.salaryMinUSD || undefined,
    salaryMax: jobPrefs?.salaryMaxUSD || undefined,
    remotePreference: jobPrefs?.remotePreference || undefined,
    preferredLocations: jobPrefs?.preferredLocations || [],
    country: canonicalCountry(personalInfo?.country),
    willingToRelocate: jobPrefs?.willingToRelocate ?? profile?.willingToRelocate ?? false,
    relocationScope: parseRelocationScope(jobPrefs?.relocationNote, jobPrefs?.willingToRelocate ?? profile?.willingToRelocate),
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const mode: AutomateMode = body.mode || 'score_only';
  const threshold = body.threshold || DEFAULT_APPLY_THRESHOLD;
  const maxApplies = Math.min(body.maxApplies || MAX_APPLIES_PER_RUN, 20);

  const runLog: string[] = [];
  const stats = { searched: 0, scored: 0, packetsBuilt: 0, submitted: 0, queued: 0, errors: 0 };

  try {
    // Step 1: Sync all company boards ─────────────────────────────────────────
    if (body.search !== false) {
      // Deactivate stale jobs first
      const stale = await cleanupStaleJobs(user.id);
      if (stale > 0) runLog.push('Deactivated ' + stale + ' stale jobs (>45 days)');

      const total = TOP_GREENHOUSE_BOARDS.length + TOP_LEVER_BOARDS.length + TOP_ASHBY_BOARDS.length;
      runLog.push('Syncing ' + total + ' company boards (Greenhouse + Lever + Ashby)...');

      const boardSources = [
        ...TOP_GREENHOUSE_BOARDS.map(s => ({ type: 'greenhouse' as const, slug: s })),
        ...TOP_LEVER_BOARDS.map(s => ({ type: 'lever' as const, slug: s })),
        ...TOP_ASHBY_BOARDS.map(s => ({ type: 'ashby' as const, slug: s })),
      ];

      try {
        const syncResult = await runJobSync(user.id, boardSources);
        stats.searched = syncResult.totalNew;
        runLog.push('Board sync complete: ' + syncResult.totalNew + ' new jobs from ' + boardSources.length + ' companies');
      } catch (syncErr) {
        runLog.push('Board sync error: ' + (syncErr instanceof Error ? syncErr.message : String(syncErr)));
      }

      // Step 1b: Multi-source aggregator (Google Jobs / JSearch=LinkedIn+ZipRecruiter+
      // Glassdoor via Google for Jobs / Adzuna / Remotive / The Muse / etc.)
      // Sources auto-enable based on which API keys are configured.
      try {
        const [jobPrefs, userProfile, personalInfo] = await Promise.all([
          prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
          prisma.userProfile.findUnique({ where: { userId: user.id } }),
          prisma.personalInfo.findUnique({ where: { userId: user.id } }),
        ]);
        const workHistory = await prisma.workHistory.findMany({
          where: { userId: user.id }, orderBy: { startDate: 'desc' }, take: 3,
        });
        let queries: string[] =
          Array.isArray(jobPrefs?.targetTitles) && jobPrefs.targetTitles.length > 0
            ? (jobPrefs.targetTitles as string[]).slice(0, 3)
            : userProfile?.jobTitle
              ? [userProfile.jobTitle]
              : workHistory.map((w: { title: string }) => w.title).filter(Boolean).slice(0, 2);
        queries = [...new Set(queries)];

        if (queries.length === 0) {
          runLog.push('Aggregator skipped: no target titles or work history to search with. Set target titles in Job Preferences.');
        } else {
          const sources = getAvailableSources();
          const homeBase = [personalInfo?.city, personalInfo?.state].filter(Boolean).join(', ');
          const locations: string[] =
            Array.isArray(jobPrefs?.preferredLocations) && jobPrefs.preferredLocations.length > 0
              ? (jobPrefs.preferredLocations as string[]).slice(0, 2)
              : homeBase ? [homeBase] : ['United States'];
          const scope = parseRelocationScope(jobPrefs?.relocationNote, jobPrefs?.willingToRelocate ?? userProfile?.willingToRelocate);
          runLog.push('Aggregator searching ' + sources.length + ' sources (' + sources.join(', ') + ') for: ' + queries.join(' | ') + ' near ' + locations.join(' / '));
          const agg = await aggregateJobSearch({
            userId: user.id, queries, locations, sources,
            userCountry: canonicalCountry(personalInfo?.country),
            allowInternational: scope === 'international',
          });
          stats.searched += agg.new;
          runLog.push('Aggregator complete: ' + agg.new + ' new jobs (' + agg.duped + ' duplicates skipped, ' + agg.filtered + ' irrelevant/out-of-area filtered, ' + agg.total + ' total found)');
        }
      } catch (aggErr) {
        runLog.push('Aggregator error: ' + (aggErr instanceof Error ? aggErr.message : String(aggErr)));
      }
    }

    // Step 2: Score all unscored jobs ─────────────────────────────────────────
    const profileData = await buildScoringProfile(user.id);
    const unscoredJobs = await prisma.job.findMany({
      where: {
        userId: user.id,
        isActive: true,
        jobScores: { none: {} },
      },
      take: 100,
    });

    if (unscoredJobs.length > 0) {
      runLog.push('Scoring ' + unscoredJobs.length + ' unscored jobs...');
      for (const job of unscoredJobs) {
        try {
          const result = scoreJob(profileData, {
            title: job.title,
            description: job.description,
            requirements: job.requirements,
            salaryMin: job.salaryMin || undefined,
            salaryMax: job.salaryMax || undefined,
            isRemote: job.isRemote || false,
            isHybrid: job.isHybrid || false,
            location: job.location || undefined,
            roleFamilies: job.roleFamilies || [],
            atsType: job.atsType || undefined,
          });
          await prisma.jobScore.create({
            data: {
              userId: user.id,
              jobId: job.id,
              score: result.score,
              overallScore: result.overallScore,
              reasoning: result.reasoning,
              recommendation: result.recommendation,
              skillScore: result.skillScore,
              roleScore: result.roleScore,
              locationScore: result.locationScore,
              compensationScore: result.compensationScore,
            },
          });
          stats.scored++;
        } catch { stats.errors++; }
      }
      runLog.push('Scored ' + stats.scored + ' jobs');
    }

    if (mode === 'score_only') {
      return NextResponse.json({ success: true, mode, stats, log: runLog });
    }

    // Step 3: Find top jobs to apply to ───────────────────────────────────────
    // Config-driven: threshold + per-run cap come from user settings (UI-tunable).
    const config = await prisma.autoApplyConfig.findUnique({ where: { userId: user.id } });
    const effectiveThreshold = body.threshold ?? config?.minScoreToApply ?? DEFAULT_APPLY_THRESHOLD;
    const perRunCap = body.maxApplies ?? config?.maxAppliesPerRun ?? 0; // 0 = unlimited

    const topJobs = await prisma.job.findMany({
      where: {
        userId: user.id,
        isActive: true,
        jobScores: { some: { userId: user.id, overallScore: { gte: effectiveThreshold } } },
        applications: { none: { userId: user.id } },
      },
      include: {
        jobScores: { where: { userId: user.id }, orderBy: { overallScore: 'desc' }, take: 1 },
      },
      take: 500,
    });
    // BUGFIX: previously ordered by jobScores _count (meaningless); order by actual score.
    topJobs.sort((a: { jobScores: Array<{ overallScore: number | null }> }, b: { jobScores: Array<{ overallScore: number | null }> }) =>
      (b.jobScores[0]?.overallScore || 0) - (a.jobScores[0]?.overallScore || 0));

    // Honor the user's blacklists/whitelist BEFORE the per-run cap, so blocked
    // jobs don't consume application slots.
    const companyBlacklist = (config?.companyBlacklist || []).map((c) => c.toLowerCase()).filter(Boolean);
    const titleBlacklist = (config?.titleBlacklist || []).map((t) => t.toLowerCase()).filter(Boolean);
    const titleWhitelist = (config?.titleWhitelist || []).map((t) => t.toLowerCase()).filter(Boolean);
    const eligibleJobs = topJobs.filter((job) => {
      const company = job.company.toLowerCase();
      const title = job.title.toLowerCase();
      if (companyBlacklist.some((c) => company.includes(c))) return false;
      if (titleBlacklist.some((t) => title.includes(t))) return false;
      if (titleWhitelist.length && !titleWhitelist.some((t) => title.includes(t))) return false;
      return true;
    });
    const filteredOut = topJobs.length - eligibleJobs.length;
    if (filteredOut > 0) runLog.push(filteredOut + ' jobs excluded by your blacklist/whitelist settings');

    const selectedJobs = perRunCap > 0 ? eligibleJobs.slice(0, perRunCap) : eligibleJobs;

    if (selectedJobs.length === 0) {
      runLog.push('No jobs above ' + effectiveThreshold + ' score threshold. Try lowering the threshold in Settings or run sync first.');
      return NextResponse.json({ success: true, mode, stats, log: runLog });
    }

    runLog.push('Found ' + selectedJobs.length + ' jobs above ' + effectiveThreshold + ' score to process' + (perRunCap > 0 ? ' (capped at ' + perRunCap + ')' : ' (no cap)'));

    // Step 4: Build packets and enqueue for the worker ─────────────────────────
    for (const job of selectedJobs) {
      const scoreData = job.jobScores[0];
      try {
        runLog.push('  ' + job.title + ' @ ' + job.company + ' (score: ' + (scoreData?.overallScore || '?') + ')');

        if (mode === 'prep_all') {
          const result = await autoApplyToJob(user.id, job.id, 'prep_only');
          stats.packetsBuilt++;
          runLog.push('    Packet ready (quality: ' + result.packet.qualityScore + '/100)');
          continue;
        }

        // auto_safe / full_auto: enqueue for the Playwright worker.
        // Task mode comes from the user's submitMode setting; auto_safe forces
        // approval unless the score clears the auto bar.
        const taskMode = mode === 'full_auto'
          ? (config?.submitMode || 'approve_first')
          : ((scoreData?.overallScore || 0) >= (config?.minScoreToAutoApply ?? 75) ? (config?.submitMode || 'approve_first') : 'approve_first');

        const enq = await enqueueApplyTask(user.id, job.id, taskMode);
        if (enq.blocked) {
          runLog.push('    Skipped: ' + enq.blocked);
        } else if (enq.duplicate && enq.duplicateInfo) {
          runLog.push('    NOTE: previously applied to ' + enq.duplicateInfo.company + ' (' + enq.duplicateInfo.role + ') — enqueued anyway per settings. Task ' + enq.taskId);
          stats.queued++;
        } else {
          stats.queued++;
          runLog.push('    Enqueued for worker (task ' + enq.taskId + ', mode ' + taskMode + ')');
        }
      } catch (err) {
        stats.errors++;
        runLog.push('    Error: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    runLog.push('');
    runLog.push('Run summary: ' + stats.searched + ' new jobs, ' + stats.scored + ' scored, ' +
      stats.packetsBuilt + ' packets built, ' + stats.queued + ' queued for the apply worker' +
      (stats.queued > 0 ? ' — track them in the Review queue' : ''));

    return NextResponse.json({ success: true, mode, stats, log: runLog });

  } catch (error) {
    console.error('Automation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Automation failed', log: runLog }, { status: 500 });
  }
}

// GET - automation status / last run summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [totalJobs, scoredJobs, highMatchJobs, applications, recentApps] = await Promise.all([
    prisma.job.count({ where: { userId: user.id, isActive: true } }),
    prisma.jobScore.count({ where: { userId: user.id } }),
    prisma.jobScore.count({ where: { userId: user.id, overallScore: { gte: DEFAULT_APPLY_THRESHOLD } } }),
    prisma.application.count({ where: { userId: user.id } }),
    prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { company: true, role: true, status: true, createdAt: true, submittedVia: true },
    }),
  ]);

  return NextResponse.json({
    pipeline: { totalJobs, scoredJobs, highMatchJobs, applications },
    recentApplications: recentApps,
    readyToRun: highMatchJobs > 0,
  });
}
