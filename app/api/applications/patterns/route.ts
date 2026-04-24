/**
 * app/api/applications/patterns/route.ts
 *
 * Analyzes application outcomes to find patterns.
 * Inspired by career-ops analyze-patterns.mjs
 *
 * Returns:
 * - Which ATS types / companies get interviews
 * - Which score ranges convert
 * - Which role families are working
 * - Rejection patterns
 * - Recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generate } from '@/lib/ai-client';

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: {
      job: {
        include: { jobScores: { where: { userId: user.id } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (applications.length < 3) {
    return NextResponse.json({
      message: 'Need at least 3 applications for pattern analysis.',
      totalApplications: applications.length,
    });
  }

  // ── Score range analysis ──────────────────────────────────────────────────
  const scoreRanges = {
    '80-100': { total: 0, interviews: 0, offers: 0, rejected: 0 },
    '60-79':  { total: 0, interviews: 0, offers: 0, rejected: 0 },
    '40-59':  { total: 0, interviews: 0, offers: 0, rejected: 0 },
    '0-39':   { total: 0, interviews: 0, offers: 0, rejected: 0 },
  };

  for (const app of applications) {
    const score = app.job?.jobScores?.[0]?.overallScore ?? 0;
    const range = score >= 80 ? '80-100' : score >= 60 ? '60-79' : score >= 40 ? '40-59' : '0-39';
    scoreRanges[range].total++;
    if (['phone_screen', 'interview'].includes(app.status)) scoreRanges[range].interviews++;
    if (app.status === 'offer') scoreRanges[range].offers++;
    if (app.status === 'rejected') scoreRanges[range].rejected++;
  }

  // ── ATS type analysis ─────────────────────────────────────────────────────
  const atsCounts: Record<string, { total: number; interviews: number }> = {};
  for (const app of applications) {
    const ats = app.job?.atsType || app.atsType || 'unknown';
    if (!atsCounts[ats]) atsCounts[ats] = { total: 0, interviews: 0 };
    atsCounts[ats].total++;
    if (['phone_screen', 'interview', 'offer'].includes(app.status)) atsCounts[ats].interviews++;
  }

  // ── Company success patterns ──────────────────────────────────────────────
  const topInterviewCompanies = applications
    .filter(a => ['phone_screen', 'interview', 'offer'].includes(a.status))
    .map(a => ({ company: a.company, role: a.role, status: a.status }))
    .slice(0, 10);

  const rejectedCompanies = applications
    .filter(a => a.status === 'rejected')
    .map(a => ({ company: a.company, role: a.role }))
    .slice(0, 10);

  // ── Response rate ─────────────────────────────────────────────────────────
  const responded = applications.filter(a => a.status !== 'applied' && a.status !== 'saved' && a.status !== 'prepping').length;
  const responseRate = Math.round((responded / applications.length) * 100);
  const interviewCount = applications.filter(a => ['phone_screen', 'interview', 'offer'].includes(a.status)).length;
  const interviewRate = Math.round((interviewCount / applications.length) * 100);

  // ── AI-generated recommendations ─────────────────────────────────────────
  let aiInsights = '';
  if (applications.length >= 5) {
    try {
      const summary =
        'Total applications: ' + applications.length + '\n' +
        'Interview rate: ' + interviewRate + '%\n' +
        'Response rate: ' + responseRate + '%\n' +
        'Score ranges that got interviews: ' + JSON.stringify(scoreRanges) + '\n' +
        'Companies that responded: ' + topInterviewCompanies.map(c => c.company).join(', ') + '\n' +
        'Companies that rejected: ' + rejectedCompanies.map(c => c.company).join(', ');

      aiInsights = await generate({
        task: 'scoring_rationale',
        maxTokens: 400,
        prompt: 'Based on this job application data, give 3-4 specific, actionable recommendations to improve the interview rate. Be direct and concrete.\n\n' + summary,
      });
    } catch { /* non-fatal */ }
  }

  // ── Optimal score threshold ───────────────────────────────────────────────
  // Find the score range with the highest interview rate
  let optimalThreshold = 50;
  let bestRate = 0;
  for (const [range, data] of Object.entries(scoreRanges)) {
    if (data.total >= 2) {
      const rate = data.interviews / data.total;
      if (rate > bestRate) {
        bestRate = rate;
        optimalThreshold = parseInt(range.split('-')[0]);
      }
    }
  }

  return NextResponse.json({
    totalApplications: applications.length,
    responseRate,
    interviewRate,
    offerCount: applications.filter(a => a.status === 'offer').length,
    scoreRangeAnalysis: scoreRanges,
    atsPerformance: atsCounts,
    topInterviewCompanies,
    rejectedCompanies,
    optimalScoreThreshold: optimalThreshold,
    aiInsights,
    recommendation: interviewRate < 10
      ? 'Interview rate is low. Focus on higher-score jobs (80+) and improve profile completeness.'
      : interviewRate < 20
        ? 'Decent interview rate. Target more companies in score range 70-100 for best ROI.'
        : 'Strong interview rate. Scale up volume while maintaining quality threshold.',
  });
}
