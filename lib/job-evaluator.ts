/**
 * lib/job-evaluator.ts
 *
 * 7-block job evaluation engine inspired by career-ops.
 * Blocks A-G give structured insight into a job posting vs user profile.
 */

import { prisma } from '@/lib/db';
import { generate } from '@/lib/ai-client';
import { addStories } from '@/lib/star-bank';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Archetype =
  | 'AI Platform / LLMOps'
  | 'Agentic / Automation'
  | 'Technical AI PM'
  | 'AI Solutions Architect'
  | 'AI Forward Deployed'
  | 'AI Transformation'
  | 'Software Engineering'
  | 'Data / Analytics'
  | 'Other';

export interface BlockA {
  archetype: Archetype;
  archetypeSecondary?: Archetype;
  domain: string;
  function: string;
  seniority: string;
  remote: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  teamSize?: string;
  tldr: string;
}

export interface CVMatchItem {
  requirement: string;
  match: string;       // exact line(s) from user profile
  strength: 'strong' | 'partial' | 'gap';
  mitigation?: string; // if gap — how to address it
}

export interface BlockB {
  matches: CVMatchItem[];
  overallFit: 'strong' | 'good' | 'stretch' | 'weak';
  topStrengths: string[];
  topGaps: string[];
}

export interface BlockC {
  detectedLevel: string;
  userLevel: string;
  sellSeniorPhrases: string[];
  downlevelPlan: string;
}

export interface BlockD {
  marketSalaryRange?: string;
  researchNeeded: string[];
  compNotes: string;
}

export interface BlockE {
  cvChanges: string[];
  linkedinChanges: string[];
}

export interface StarStoryData {
  requirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
}

export interface BlockF {
  stories: StarStoryData[];
  redFlagQAs: Array<{ question: string; answer: string }>;
  recommendedCaseStudy?: string;
}

export interface LegitimacySignal {
  signal: string;
  finding: string;
  weight: 'positive' | 'neutral' | 'concerning';
}

export interface BlockG {
  tier: 'High Confidence' | 'Proceed with Caution' | 'Suspicious';
  signals: LegitimacySignal[];
  notes: string;
}

export interface JobEvaluationResult {
  blockA: BlockA;
  blockB: BlockB;
  blockC: BlockC;
  blockD: BlockD;
  blockE: BlockE;
  blockF: BlockF;
  blockG: BlockG;
  archetype: Archetype;
  score: number; // 1–5
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateJobEvaluation(
  jobId: string,
  userId: string
): Promise<JobEvaluationResult> {
  // Fetch job
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Fetch user profile
  const [profile, workHistory, skills, education] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.educationEntry.findMany({ where: { userId } }),
  ]);

  const profileContext = buildProfileContext(profile, workHistory, skills, education);
  const jobContext = `
Company: ${job.company}
Title: ${job.title}
Location: ${job.location || 'Not specified'}
Description:
${job.description || 'No description available'}
  `.trim();

  // Run all blocks in parallel (blocks that don't depend on each other)
  const [blockA_raw, blockB_raw, blockC_raw, blockE_raw, blockF_raw, blockG_raw] = await Promise.all([
    generateBlockA(jobContext),
    generateBlockB(jobContext, profileContext),
    generateBlockC(jobContext, profileContext),
    generateBlockE(jobContext, profileContext),
    generateBlockF(jobContext, profileContext),
    generateBlockG(jobContext),
  ]);

  const blockA = safeParseJSON<BlockA>(blockA_raw, defaultBlockA());
  const blockB = safeParseJSON<BlockB>(blockB_raw, defaultBlockB());
  const blockC = safeParseJSON<BlockC>(blockC_raw, defaultBlockC());
  const blockD = generateBlockD(job.company, blockA.archetype);
  const blockE = safeParseJSON<BlockE>(blockE_raw, defaultBlockE());
  const blockF = safeParseJSON<BlockF>(blockF_raw, defaultBlockF());
  const blockG = safeParseJSON<BlockG>(blockG_raw, defaultBlockG());

  // Score: weighted from blockB fit + blockG legitimacy
  const fitScore = { strong: 5, good: 4, stretch: 3, weak: 2 }[blockB.overallFit] ?? 3;
  const legPenalty = blockG.tier === 'Suspicious' ? 0.5 : blockG.tier === 'Proceed with Caution' ? 0.2 : 0;
  const score = Math.max(1, Math.min(5, fitScore - legPenalty));

  const result: JobEvaluationResult = {
    blockA, blockB, blockC, blockD, blockE, blockF, blockG,
    archetype: blockA.archetype,
    score,
  };

  // Upsert evaluation to DB
  await prisma.jobEvaluation.upsert({
    where: { jobId },
    create: {
      jobId,
      userId,
      blockA: blockA as object,
      blockB: blockB as object,
      blockC: blockC as object,
      blockD: blockD as object,
      blockE: blockE as object,
      blockF: blockF as object,
      blockG: blockG as object,
      archetype: blockA.archetype,
      score,
    },
    update: {
      blockA: blockA as object,
      blockB: blockB as object,
      blockC: blockC as object,
      blockD: blockD as object,
      blockE: blockE as object,
      blockF: blockF as object,
      blockG: blockG as object,
      archetype: blockA.archetype,
      score,
      updatedAt: new Date(),
    },
  });

  // Save STAR stories to story bank
  if (blockF.stories.length > 0) {
    await addStories(userId, blockF.stories, jobId);
  }

  return result;
}

// ─── Block generators ─────────────────────────────────────────────────────────

async function generateBlockA(jobContext: string): Promise<string> {
  return generate({
    task: 'job_analysis',
    maxTokens: 400,
    systemPrompt: 'You are a job analysis expert. Respond ONLY with valid JSON, no markdown.',
    prompt: `Analyze this job posting and return a JSON object with exactly these fields:
{
  "archetype": one of: "AI Platform / LLMOps"|"Agentic / Automation"|"Technical AI PM"|"AI Solutions Architect"|"AI Forward Deployed"|"AI Transformation"|"Software Engineering"|"Data / Analytics"|"Other",
  "archetypeSecondary": optional second archetype if hybrid,
  "domain": short domain string (e.g. "fintech", "enterprise SaaS", "consumer AI"),
  "function": "build"|"consult"|"manage"|"deploy"|"research"|"other",
  "seniority": "junior"|"mid"|"senior"|"staff"|"principal"|"director"|"unknown",
  "remote": "remote"|"hybrid"|"onsite"|"unknown",
  "teamSize": team size if mentioned or null,
  "tldr": one sentence summary of the role
}

Job posting:
${jobContext}`,
  });
}

async function generateBlockB(jobContext: string, profileContext: string): Promise<string> {
  return generate({
    task: 'job_analysis',
    maxTokens: 1200,
    systemPrompt: 'You are a resume and job matching expert. Respond ONLY with valid JSON, no markdown.',
    prompt: `Map each key requirement from the job posting to the candidate's profile. Return JSON:
{
  "matches": [
    {
      "requirement": "requirement text",
      "match": "exact relevant experience from profile, or 'No match found'",
      "strength": "strong"|"partial"|"gap",
      "mitigation": "if gap: how to address it in application"
    }
  ],
  "overallFit": "strong"|"good"|"stretch"|"weak",
  "topStrengths": ["top 3 reasons this candidate is a strong fit"],
  "topGaps": ["top 3 gaps or concerns"]
}

Extract 5-8 key requirements from the job posting and assess each one.

CANDIDATE PROFILE:
${profileContext}

JOB POSTING:
${jobContext}`,
  });
}

async function generateBlockC(jobContext: string, profileContext: string): Promise<string> {
  return generate({
    task: 'job_analysis',
    maxTokens: 600,
    systemPrompt: 'You are a senior career coach. Respond ONLY with valid JSON, no markdown.',
    prompt: `Assess the seniority positioning for this candidate applying to this role. Return JSON:
{
  "detectedLevel": "the level this role is actually targeting",
  "userLevel": "estimated level of this candidate based on their profile",
  "sellSeniorPhrases": ["3-4 specific phrases to frame their experience at a senior level, grounded in their actual history"],
  "downlevelPlan": "brief strategy if they get downleveled (negotiate timeline, comp, promotion criteria)"
}

CANDIDATE PROFILE:
${profileContext}

JOB POSTING:
${jobContext}`,
  });
}

function generateBlockD(company: string, archetype: Archetype): BlockD {
  // No live web search available — return structured research guidance
  return {
    researchNeeded: [
      `Search "${company} salary ${archetype}" on Glassdoor and Levels.fyi`,
      `Search "${company} layoffs 2025 2026" to check hiring signals`,
      `Check "${company} engineering blog" for culture and tech stack signals`,
      `Search "${company} funding round" for company stability`,
    ],
    marketSalaryRange: undefined,
    compNotes: `Comp data requires live research. Use the queries above on Glassdoor, Levels.fyi, and Blind. For ${archetype} roles, market rates vary significantly by location and company stage.`,
  };
}

async function generateBlockE(jobContext: string, profileContext: string): Promise<string> {
  return generate({
    task: 'resume_summary',
    maxTokens: 600,
    systemPrompt: 'You are a resume optimization expert. Respond ONLY with valid JSON, no markdown.',
    prompt: `Suggest specific changes to maximize this candidate's match for this role. Return JSON:
{
  "cvChanges": ["5 specific, actionable changes to their CV/resume for this role"],
  "linkedinChanges": ["5 specific changes to their LinkedIn profile headline, summary, or skills"]
}

Changes must be grounded in their ACTUAL experience — only suggest repositioning real experience, never inventing.

CANDIDATE PROFILE:
${profileContext}

JOB POSTING:
${jobContext}`,
  });
}

async function generateBlockF(jobContext: string, profileContext: string): Promise<string> {
  return generate({
    task: 'answer_behavioral',
    maxTokens: 1500,
    systemPrompt: 'You are an expert interview coach. Respond ONLY with valid JSON, no markdown.',
    prompt: `Generate interview prep materials based on the candidate's ACTUAL work history. Return JSON:
{
  "stories": [
    {
      "requirement": "which JD requirement this story addresses",
      "situation": "brief context (1-2 sentences from their actual history)",
      "task": "what they specifically needed to accomplish",
      "action": "what they actually did — use details from their profile",
      "result": "concrete outcome if available in their history",
      "reflection": "what this demonstrates or what they learned (the +R)",
      "tags": ["relevant skill tags"]
    }
  ],
  "redFlagQAs": [
    {
      "question": "a likely tough question for this candidate",
      "answer": "suggested honest response strategy"
    }
  ],
  "recommendedCaseStudy": "which project/achievement from their history to highlight and why"
}

Generate 3-5 STAR+R stories and 2-3 red-flag Q&As. Only use details from their actual profile.

CANDIDATE PROFILE:
${profileContext}

JOB POSTING:
${jobContext}`,
  });
}

async function generateBlockG(jobContext: string): Promise<string> {
  return generate({
    task: 'job_analysis',
    maxTokens: 500,
    systemPrompt: 'You are a job market analyst specializing in identifying ghost jobs. Respond ONLY with valid JSON, no markdown.',
    prompt: `Assess the legitimacy of this job posting based on description quality signals only (no live page access). Return JSON:
{
  "tier": "High Confidence"|"Proceed with Caution"|"Suspicious",
  "signals": [
    {
      "signal": "signal name",
      "finding": "what you observed",
      "weight": "positive"|"neutral"|"concerning"
    }
  ],
  "notes": "brief context or caveats"
}

Assess these signals:
1. Description specificity (named tech, team size, reporting structure)
2. Requirements realism (years of experience vs technology age)
3. Scope clarity (clear 6-12 month objectives)
4. Salary transparency
5. Internal consistency (no contradictions)
6. Generic boilerplate ratio

JOB POSTING:
${jobContext}`,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProfileContext(
  profile: any,
  workHistory: any[],
  skills: any[],
  education: any[]
): string {
  const lines: string[] = [];

  if (profile) {
    if (profile.jobTitle) lines.push(`Current target role: ${profile.jobTitle}`);
    if (profile.careerGoals) lines.push(`Career goals: ${profile.careerGoals}`);
    if (profile.location) lines.push(`Location: ${profile.location}`);
  }

  if (workHistory.length > 0) {
    lines.push('\nWork History:');
    for (const w of workHistory.slice(0, 5)) {
      lines.push(`- ${w.title} at ${w.company} (${w.startDate ? new Date(w.startDate).getFullYear() : '?'} - ${w.endDate ? new Date(w.endDate).getFullYear() : 'present'})`);
      if (w.description) lines.push(`  ${w.description.slice(0, 200)}`);
    }
  }

  if (skills.length > 0) {
    lines.push(`\nSkills: ${skills.map((s: any) => s.name).join(', ')}`);
  }

  if (education.length > 0) {
    lines.push('\nEducation:');
    for (const e of education) {
      lines.push(`- ${e.degree || 'Degree'} in ${e.fieldOfStudy || 'field'} from ${e.institution}`);
    }
  }

  return lines.join('\n') || 'No profile information available.';
}

function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn('[job-evaluator] Failed to parse JSON block:', raw.slice(0, 100));
    return fallback;
  }
}

function defaultBlockA(): BlockA {
  return { archetype: 'Other', domain: '', function: 'other', seniority: 'unknown', remote: 'unknown', tldr: '' };
}
function defaultBlockB(): BlockB {
  return { matches: [], overallFit: 'stretch', topStrengths: [], topGaps: [] };
}
function defaultBlockC(): BlockC {
  return { detectedLevel: 'unknown', userLevel: 'unknown', sellSeniorPhrases: [], downlevelPlan: '' };
}
function defaultBlockE(): BlockE {
  return { cvChanges: [], linkedinChanges: [] };
}
function defaultBlockF(): BlockF {
  return { stories: [], redFlagQAs: [] };
}
function defaultBlockG(): BlockG {
  return { tier: 'Proceed with Caution', signals: [], notes: 'Unable to assess — no description data.' };
}
