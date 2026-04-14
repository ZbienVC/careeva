/**
 * app/api/jobs/compare/route.ts
 *
 * Multi-offer comparison matrix (career-ops ofertas mode)
 * Scores multiple jobs on 10 weighted dimensions.
 *
 * POST body: { jobIds: string[] }
 * Returns scored comparison table + recommendation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generate } from '@/lib/ai-client';

// 10-dimension weighted scoring matrix from career-ops
const DIMENSIONS = [
  { key: 'north_star',     label: 'Role Alignment',      weight: 0.25, hint: 'How closely does this match your target role/archetype?' },
  { key: 'cv_match',       label: 'CV Match',            weight: 0.15, hint: 'How well does your profile match requirements?' },
  { key: 'seniority',      label: 'Seniority Level',     weight: 0.15, hint: 'Senior/staff = 5, junior = 1' },
  { key: 'compensation',   label: 'Compensation',        weight: 0.10, hint: 'Top quartile = 5, below market = 1' },
  { key: 'growth',         label: 'Growth Trajectory',   weight: 0.10, hint: 'Clear path to next level = 5' },
  { key: 'remote',         label: 'Remote Quality',      weight: 0.05, hint: 'Full remote async = 5, onsite only = 1' },
  { key: 'reputation',     label: 'Company Reputation',  weight: 0.05, hint: 'Top employer = 5, red flags = 1' },
  { key: 'tech_stack',     label: 'Tech Stack',          weight: 0.05, hint: 'Cutting edge AI/ML = 5, legacy = 1' },
  { key: 'speed',          label: 'Process Speed',       weight: 0.05, hint: 'Fast hiring = 5, 6+ months = 1' },
  { key: 'culture',        label: 'Culture Signals',     weight: 0.05, hint: 'Builder culture = 5, bureaucratic = 1' },
] as const;

type DimensionKey = typeof DIMENSIONS[number]['key'];

interface JobScore {
  jobId: string;
  title: string;
  company: string;
  scores: Record<DimensionKey, number>;
  weightedTotal: number;
  rank: number;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobIds } = await request.json().catch(() => ({ jobIds: [] }));

  if (!Array.isArray(jobIds) || jobIds.length < 2) {
    return NextResponse.json({ error: 'At least 2 job IDs required for comparison' }, { status: 400 });
  }
  if (jobIds.length > 6) {
    return NextResponse.json({ error: 'Maximum 6 jobs can be compared at once' }, { status: 400 });
  }

  // Fetch all jobs
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, userId: user.id },
    include: {
      jobScores: { where: { userId: user.id } },
    },
  });

  if (jobs.length < 2) {
    return NextResponse.json({ error: 'Could not find the requested jobs' }, { status: 404 });
  }

  // Fetch user profile for context
  const [jobPrefs, workHistory, skills] = await Promise.all([
    prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
    prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' }, take: 3 }),
    prisma.skill.findMany({ where: { userId: user.id }, take: 20 }),
  ]);

  const userSkills = new Set(skills.map(s => s.name.toLowerCase()));
  const targetTitles = jobPrefs?.targetTitles || [];
  const salaryMin = jobPrefs?.salaryMinUSD || 0;

  // Score each job on all 10 dimensions
  const scoredJobs: JobScore[] = jobs.map(job => {
    const text = (job.title + ' ' + job.description + ' ' + job.requirements).toLowerCase();
    const jdScore = job.jobScores[0]?.overallScore || 50;

    // Auto-score each dimension based on job data
    const scores: Record<string, number> = {};

    // North star: title match to targets
    scores.north_star = targetTitles.some(t => job.title.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(job.title.toLowerCase().split(' ')[0]))
      ? 5 : targetTitles.length === 0 ? 3 : Math.max(1, Math.round(jdScore / 25));

    // CV match: based on existing job score
    scores.cv_match = Math.max(1, Math.round(jdScore / 20));

    // Seniority
    if (/staff|principal|director|vp\b/i.test(job.title)) scores.seniority = 5;
    else if (/senior|sr\.|lead\b/i.test(job.title)) scores.seniority = 4;
    else if (/mid|ii\b|2\b/i.test(job.title)) scores.seniority = 3;
    else if (/junior|jr\.|i\b/i.test(job.title)) scores.seniority = 2;
    else scores.seniority = 3; // unknown = mid

    // Compensation
    if (job.salaryMax && job.salaryMax >= salaryMin * 1.2) scores.compensation = 5;
    else if (job.salaryMax && job.salaryMax >= salaryMin) scores.compensation = 4;
    else if (job.salaryMin && job.salaryMin >= salaryMin * 0.85) scores.compensation = 3;
    else if (!job.salaryMin && !job.salaryMax) scores.compensation = 3; // unknown
    else scores.compensation = 2;

    // Growth: infer from company type
    if (/series [cde]|unicorn|ipo|nasdaq|nyse/i.test(text)) scores.growth = 4;
    else if (/seed|series [ab]|startup|early.stage/i.test(text)) scores.growth = 5; // high growth potential
    else if (/fortune 500|enterprise|established/i.test(text)) scores.growth = 3;
    else scores.growth = 3;

    // Remote
    if (job.isRemote && !/hybrid/i.test(text)) scores.remote = 5;
    else if (job.isHybrid) scores.remote = 3;
    else scores.remote = 1;

    // Reputation: based on known companies
    const topTier = ['anthropic', 'openai', 'stripe', 'figma', 'notion', 'linear', 'vercel', 'airbnb', 'coinbase', 'databricks'];
    scores.reputation = topTier.some(c => job.company.toLowerCase().includes(c)) ? 5 : 3;

    // Tech stack: AI/ML stack = high score
    if (/llm|gpt|claude|gemini|anthropic|openai|pytorch|transformers/i.test(text)) scores.tech_stack = 5;
    else if (/python|typescript|react|next\.js|postgres|kubernetes/i.test(text)) scores.tech_stack = 4;
    else if (/java|php|ruby|cobol|mainframe/i.test(text)) scores.tech_stack = 2;
    else scores.tech_stack = 3;

    // Speed: ATS type as proxy (ashby = fastest, workday = slowest)
    if (job.atsType === 'ashby' || job.atsType === 'lever') scores.speed = 4;
    else if (job.atsType === 'greenhouse') scores.speed = 4;
    else if (job.atsType === 'workday') scores.speed = 2;
    else scores.speed = 3;

    // Culture: builder signals
    if (/founding|early team|shape the/i.test(text)) scores.culture = 5;
    else if (/startup|fast.paced|no bureaucracy/i.test(text)) scores.culture = 4;
    else if (/enterprise|process|governance/i.test(text)) scores.culture = 2;
    else scores.culture = 3;

    // Calculate weighted total
    const weightedTotal = DIMENSIONS.reduce((sum, dim) => {
      return sum + (scores[dim.key] || 3) * dim.weight;
    }, 0);

    return {
      jobId: job.id,
      title: job.title,
      company: job.company,
      scores: scores as Record<DimensionKey, number>,
      weightedTotal: Math.round(weightedTotal * 100) / 100,
      rank: 0,
    };
  });

  // Rank by weighted total
  scoredJobs.sort((a, b) => b.weightedTotal - a.weightedTotal);
  scoredJobs.forEach((j, i) => { j.rank = i + 1; });

  // Generate AI recommendation
  let recommendation = '';
  try {
    const summary = scoredJobs.map(j =>
      j.rank + '. ' + j.company + ' - ' + j.title + ' (score: ' + j.weightedTotal.toFixed(2) + '/5)'
    ).join('\n');

    recommendation = await generate({
      task: 'scoring_rationale',
      maxTokens: 300,
      prompt: 'Based on this multi-offer comparison, give a 2-paragraph recommendation on which role to prioritize and why. Be direct and specific.\n\nRanking:\n' + summary,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    comparison: scoredJobs,
    dimensions: DIMENSIONS,
    recommendation,
    winner: scoredJobs[0],
  });
}
