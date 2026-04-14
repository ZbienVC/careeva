/**
 * /api/automate/route.ts
 * 
 * The automation engine - orchestrates the full apply pipeline:
 * 1. Search for new jobs
 * 2. Score all unscored jobs
 * 3. Generate application packets for top-scoring jobs
 * 4. Submit to ATS (Greenhouse/Lever) or queue for review
 * 
 * Called via:
 * - Manual: POST /api/automate { mode: 'run' }
 * - Scheduled: can be triggered by a cron endpoint
 * 
 * Modes:
 *   'score_only'     - just find and score jobs, no applying
 *   'prep_all'       - generate packets for all high-scoring jobs, no submit
 *   'auto_safe'      - auto-submit to Greenhouse/Lever where confident, queue rest
 *   'full_auto'      - submit everything above threshold
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { aggregateJobSearch } from '@/lib/job-search';
import { runJobSync, cleanupStaleJobs, TOP_GREENHOUSE_BOARDS, TOP_LEVER_BOARDS, TOP_ASHBY_BOARDS } from '@/lib/job-connectors';
import { autoApplyToJob } from '@/lib/auto-apply';
import { scoreJob } from '@/lib/job-scorer';

const DEFAULT_APPLY_THRESHOLD = 50; // score >= 70 to attempt apply
const MAX_APPLIES_PER_RUN = 10;     // safety limit

type AutomateMode = 'score_only' | 'prep_all' | 'auto_safe' | 'full_auto';

async function buildScoringProfile(userId: string) {
  const [profile, skills, jobPrefs, workHistory] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
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
    // ── Step 1: Search for new jobs (if requested) ──────────────────────────
    if (body.search !== false) {
      // Clean stale jobs first
      const stale = await cleanupStaleJobs(user.id);
      if (stale > 0) runLog.push(\uD83E\uDDF9 Deactivated \ stale jobs (>45 days old));
      runLog.push(\uD83D\uDD0D Syncing \ company boards...);
      const boardSources = [
        ...TOP_GREENHOUSE_BOARDS.map(s => ({ type: 'greenhouse' as const, slug: s })),
        ...TOP_LEVER_BOARDS.map(s => ({ type: 'lever' as const, slug: s })),
        ...TOP_ASHBY_BOARDS.map(s => ({ type: 'ashby' as const, slug: s })),
      ];
      try {
        const syncResult = await runJobSync(user.id, boardSources);
        stats.searched = syncResult.totalNew;
        runLog.push(\u2705 Board sync: \ new jobs from \ companies);
      } catch (syncErr) {
        runLog.push(\u26A0\uFE0F Board sync error: \);
      }
    }

    // ── Step 2: Score all unscored jobs ──────────────────────────────────────
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
      runLog.push(`📊 Scoring ${unscoredJobs.length} unscored jobs...`);
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
      runLog.push(`✓ Scored ${stats.scored} jobs`);
    }

    if (mode === 'score_only') {
      return NextResponse.json({ success: true, mode, stats, log: runLog });
    }

    // ── Step 3: Find top jobs to apply to ────────────────────────────────────
    const topJobs = await prisma.job.findMany({
      where: {
        userId: user.id,
        isActive: true,
        jobScores: { some: { userId: user.id, overallScore: { gte: threshold } } },
        applications: { none: { userId: user.id } }, // Not already applied
      },
      include: {
        jobScores: { where: { userId: user.id } },
      },
      orderBy: { jobScores: { _count: 'desc' } },
      take: maxApplies,
    });

    if (topJobs.length === 0) {
      runLog.push(`ℹ️ No jobs above ${threshold} score threshold. Consider lowering threshold or adding more target titles.`);
      return NextResponse.json({ success: true, mode, stats, log: runLog });
    }

    runLog.push(`🎯 Found ${topJobs.length} jobs above ${threshold} score to process`);

    // ── Step 4: Generate and submit applications ──────────────────────────────
    for (const job of topJobs) {
      const scoreData = job.jobScores[0];
      const applyMode = mode === 'full_auto' ? 'auto' :
                        mode === 'auto_safe' ? (scoreData?.recommendation === 'auto_apply' ? 'auto' : 'review_first') :
                        'prep_only';

      try {
        runLog.push(`  → ${job.title} @ ${job.company} (score: ${scoreData?.overallScore || '?'})`);
        const result = await autoApplyToJob(user.id, job.id, applyMode);

        if (result.status === 'applied') {
          stats.submitted++;
          runLog.push(`    ✅ Submitted! Application ID: ${result.applicationId || 'unknown'}`);
        } else if (result.status === 'queued_for_review') {
          stats.queued++;
          runLog.push(`    📋 Queued for review (${result.packet.missingFields?.length ? `missing: ${result.packet.missingFields.join(', ')}` : 'needs manual check'})`);
        } else if (result.status === 'prep_ready') {
          stats.packetsBuilt++;
          runLog.push(`    📝 Application packet ready (confidence: ${Math.round(result.packet.confidence * 100)}%)`);
        }
      } catch (err) {
        stats.errors++;
        runLog.push(`    ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    runLog.push(`\n📊 Run Summary: ${stats.searched} new jobs found, ${stats.scored} scored, ${stats.packetsBuilt} packets built, ${stats.submitted} submitted, ${stats.queued} queued`);

    return NextResponse.json({ success: true, mode, stats, log: runLog });
  } catch (error) {
    console.error('Automation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Automation failed', log: runLog }, { status: 500 });
  }
}

// GET - get automation status/last run summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [totalJobs, scoredJobs, highMatchJobs, applications, recentApps] = await Promise.all([
    prisma.job.count({ where: { userId: user.id, isActive: true } }),
    prisma.jobScore.count({ where: { userId: user.id } }),
    prisma.jobScore.count({ where: { userId: user.id, overallScore: { gte: 70 } } }),
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
