/**
 * app/api/jobs/[id]/interview-prep/route.ts
 *
 * Company-specific interview intelligence (career-ops interview-prep mode)
 *
 * Generates:
 * - Process overview (rounds, timeline, difficulty)
 * - Round-by-round breakdown with likely questions
 * - STAR story recommendations per round
 * - Red flag Q&As
 * - Tech/system design topics (if applicable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generate } from '@/lib/ai-client';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;

  const [job, evaluation, workHistory, skills, personalInfo] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.jobEvaluation.findUnique({ where: { jobId } }),
    prisma.workHistory.findMany({ where: { userId: user.id }, include: { bullets: true }, orderBy: { startDate: 'desc' }, take: 4 }),
    prisma.skill.findMany({ where: { userId: user.id }, take: 20 }),
    prisma.personalInfo.findUnique({ where: { userId: user.id } }),
  ]);

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const candidateName = personalInfo?.fullName || 'the candidate';
  const currentRole = workHistory[0] ? workHistory[0].title + ' at ' + workHistory[0].company : 'professional';
  const topSkills = skills.slice(0, 8).map(s => s.name).join(', ');
  const workSummary = workHistory.slice(0, 3).map(w =>
    w.title + ' at ' + w.company + ': ' + (w.summary || '') +
    (w.bullets.length > 0 ? '\nKey achievements: ' + w.bullets.slice(0, 2).map(b => b.content).join('; ') : '')
  ).join('\n\n');

  const jdContext = [job.title, job.company, job.description?.slice(0, 1500)].filter(Boolean).join('\n');
  const evalContext = evaluation ? JSON.stringify({
    archetype: evaluation.archetype,
    blockB: evaluation.blockB,
    blockF: evaluation.blockF,
  }).slice(0, 2000) : '';

  // Generate comprehensive interview prep in parallel sections
  const [processOverview, roundBreakdown, starStories, redFlags, techTopics] = await Promise.all([

    // Process overview
    generate({
      task: 'job_analysis',
      maxTokens: 400,
      prompt: `Based on the job posting, describe the likely interview process for ${job.title} at ${job.company}.
Include: estimated rounds (1-5), typical format (phone/video/onsite), likely timeline (1-4 weeks), difficulty level (1-5).
Format as JSON: {"rounds": N, "format": "...", "timelineWeeks": N, "difficulty": N, "notes": "...", "processDescription": "..."}

Job posting:
${jdContext}`,
      systemPrompt: 'You are an expert on tech company hiring processes. Return ONLY valid JSON.',
    }),

    // Round-by-round breakdown
    generate({
      task: 'answer_behavioral',
      maxTokens: 800,
      prompt: `Generate a round-by-round interview breakdown for ${job.title} at ${job.company}.
For each round, provide: round name, what they assess, 3-4 likely questions, how to prepare.
Base this on the job requirements.

Return as JSON array: [{"round": "Recruiter Screen", "assesses": "...", "questions": ["...", "..."], "prepTip": "..."}]

Job posting:
${jdContext}`,
      systemPrompt: 'You are an expert interviewer. Return ONLY valid JSON array.',
    }),

    // STAR stories mapped to this specific role
    generate({
      task: 'answer_behavioral',
      maxTokens: 600,
      prompt: `Map this candidate's work history to the top interview questions for ${job.title} at ${job.company}.
Select 3-4 experiences from their history that best answer key questions for this role.
Each story should be in STAR format mapped to a likely question.

Return JSON: [{"question": "...", "situation": "...", "task": "...", "action": "...", "result": "...", "reflection": "..."}]

Candidate background:
${workSummary}

Role requirements:
${jdContext.slice(0, 800)}`,
      systemPrompt: 'You are an interview coach. Only use facts from the provided background. Return ONLY valid JSON.',
    }),

    // Red flag questions (questions that are hard given gaps)
    generate({
      task: 'job_analysis',
      maxTokens: 400,
      prompt: `Identify 3-4 potentially difficult interview questions for this candidate applying to ${job.title} at ${job.company}.
These are questions where there might be a gap or sensitivity.
Provide a strategy to answer each honestly and confidently.

Return JSON: [{"question": "...", "whyDifficult": "...", "strategy": "..."}]

Candidate skills: ${topSkills}
${evalContext ? 'Evaluation gaps: ' + JSON.stringify((evaluation?.blockB as any)?.topGaps || []) : ''}

Job description: ${jdContext.slice(0, 600)}`,
      systemPrompt: 'Return ONLY valid JSON array.',
    }),

    // Tech/system design topics (if engineering role)
    /engineer|developer|architect|technical/i.test(job.title)
      ? generate({
          task: 'job_analysis',
          maxTokens: 300,
          prompt: `List 4-6 technical topics likely to come up in interviews for ${job.title} at ${job.company}.
For each topic, list what to study and a preparation resource.
Return JSON: [{"topic": "...", "whatToKnow": "...", "prepAction": "..."}]

Job tech requirements: ${jdContext.slice(0, 600)}`,
          systemPrompt: 'Return ONLY valid JSON array.',
        })
      : Promise.resolve('[]'),
  ]);

  // Parse all JSON safely
  function safeParse(raw: string, fallback: any = null) {
    try { return JSON.parse(raw.replace(/```json\n?|```/g, '').trim()); }
    catch { return fallback; }
  }

  const process = safeParse(processOverview, { rounds: 3, format: 'Video + Onsite', timelineWeeks: 2, difficulty: 3, notes: 'Standard tech interview process' });
  const rounds = safeParse(roundBreakdown, []);
  const stories = safeParse(starStories, []);
  const hardQuestions = safeParse(redFlags, []);
  const techPrepTopics = safeParse(techTopics, []);

  // Save to DB for future access
  await prisma.applicationEvent.create({
    data: {
      applicationId: (await prisma.application.findFirst({ where: { userId: user.id, jobId } }))?.id || '',
      eventType: 'interview_prep_generated',
      toStatus: 'interview',
      note: 'Interview prep generated for ' + job.title + ' at ' + job.company,
      metadata: { jobId, generated: new Date().toISOString() },
    },
  }).catch(() => {}); // non-fatal if no application exists

  return NextResponse.json({
    job: { title: job.title, company: job.company, archetype: evaluation?.archetype },
    process,
    rounds,
    starStories: stories,
    hardQuestions,
    techPrepTopics,
    generatedAt: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: jobId } = await params;

  // Check if prep was already generated
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { title: true, company: true } });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  return NextResponse.json({
    message: 'POST to this endpoint to generate interview prep',
    job,
  });
}
