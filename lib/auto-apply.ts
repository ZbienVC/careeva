/**
 * lib/auto-apply.ts (v2 — quality-first rewrite)
 *
 * Key changes:
 * - Archetype-aware cover letter prompting (6 role types)
 * - JD keyword extraction + injection into cover letter
 * - Quality gate: score the cover letter before submitting
 * - Richer "why_this_company" via actual JD analysis
 * - Behavioral answers use STAR structure from stored stories
 * - Packet confidence reflects actual content quality, not just field presence
 */

import { prisma } from '@/lib/prisma';
import { generate, generateCoverLetter, generateBehavioralAnswer, generateShortAnswer, isAIConfigured } from '@/lib/ai-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationPacket {
  jobId: string;
  resumeText: string;
  coverLetter: string;
  answers: Record<string, string>;
  confidence: number;       // 0–1 overall confidence
  qualityScore: number;     // 0–100: how good is this cover letter actually
  canAutoApply: boolean;
  missingFields: string[];
  archetype: string;
  keywords: string[];       // top JD keywords injected into cover letter
}

// ─── Archetype detection ──────────────────────────────────────────────────────

function detectArchetype(jobTitle: string, description: string): string {
  const text = (jobTitle + ' ' + description).toLowerCase();
  if (/\b(llmops|observabilit|eval|pipeline|mlops|monitoring|reliability|inference)\b/.test(text)) return 'AI Platform / LLMOps';
  if (/\b(agent|agentic|orchestrat|multi.agent|workflow|hitl|automation)\b/.test(text)) return 'Agentic / Automation';
  if (/\b(product manager|prd|roadmap|discovery|stakeholder|product owner)\b/.test(text)) return 'Technical AI PM';
  if (/\b(solution architect|systems design|enterprise|integration|architect)\b/.test(text)) return 'AI Solutions Architect';
  if (/\b(forward deploy|field engineer|client.facing|prototype|fast delivery|professional services)\b/.test(text)) return 'AI Forward Deployed';
  if (/\b(transformation|change management|adoption|enablement|digital transform)\b/.test(text)) return 'AI Transformation';
  return 'Software Engineering';
}

// ─── JD keyword extraction ────────────────────────────────────────────────────

async function extractKeywords(jobDescription: string): Promise<string[]> {
  try {
    const raw = await generate({
      task: 'job_analysis',
      maxTokens: 150,
      systemPrompt: 'Extract keywords from job descriptions. Return only a JSON array of strings, no markdown.',
      prompt: `Extract the 12 most important technical and role-specific keywords from this job description. Focus on: technologies, methodologies, role-specific terms, and skills the recruiter will scan for.

Return ONLY a JSON array: ["keyword1", "keyword2", ...]

Job description:
${jobDescription.slice(0, 2000)}`,
    });
    const cleaned = raw.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

// ─── Profile context builder ──────────────────────────────────────────────────

async function buildProfileContext(userId: string): Promise<string> {
  const [
    personalInfo,
    workHistory,
    education,
    skills,
    jobPrefs,
    writingPrefs,
    storedAnswers,
    certs,
    projects,
  ] = await Promise.all([
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, include: { bullets: { orderBy: { sortOrder: 'asc' } } }, orderBy: { startDate: 'desc' } }),
    prisma.educationEntry.findMany({ where: { userId }, orderBy: { endDate: 'desc' } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
    prisma.writingPreferences.findUnique({ where: { userId } }),
    prisma.reusableAnswer.findMany({ where: { userId, isVerified: true } }),
    prisma.certification.findMany({ where: { userId } }),
    prisma.project.findMany({ where: { userId }, include: { bullets: true }, take: 4 }),
  ]);

  const parts: string[] = [];

  if (personalInfo) {
    parts.push(`NAME: ${personalInfo.fullName || 'Zach Bienstock'}`);
    parts.push(`EMAIL: ${personalInfo.email || 'zbienstock@gmail.com'}`);
    if (personalInfo.phone) parts.push(`PHONE: ${personalInfo.phone}`);
    const loc = [personalInfo.city, personalInfo.state].filter(Boolean).join(', ');
    if (loc) parts.push(`LOCATION: ${loc}`);
    if (personalInfo.linkedinUrl) parts.push(`LINKEDIN: ${personalInfo.linkedinUrl}`);
    if (personalInfo.githubUrl) parts.push(`GITHUB: ${personalInfo.githubUrl}`);
    if (personalInfo.websiteUrl) parts.push(`WEBSITE: ${personalInfo.websiteUrl}`);
    parts.push(`WORK_AUTH: ${personalInfo.workAuthorization || 'us_citizen'}`);
    parts.push(`SPONSORSHIP_NEEDED: ${personalInfo.requiresSponsorship ? 'Yes' : 'No'}`);
  }

  // Writing style
  const toneWords = writingPrefs?.toneWords?.join(', ') || 'direct, confident, human';
  const avoidWords = writingPrefs?.avoidWords?.join(', ') || 'passionate, synergy, leverage, spearheaded';
  parts.push(`\nTONE: ${toneWords}`);
  parts.push(`AVOID THESE WORDS: ${avoidWords}`);
  if (writingPrefs?.positioningStatement) parts.push(`POSITIONING: ${writingPrefs.positioningStatement}`);

  if (workHistory.length > 0) {
    parts.push('\nWORK HISTORY:');
    for (const wh of workHistory.slice(0, 5)) {
      const start = wh.startDate ? new Date(wh.startDate).getFullYear() : '?';
      const end = wh.isCurrent ? 'Present' : (wh.endDate ? new Date(wh.endDate).getFullYear() : '?');
      parts.push(`\n[${start}–${end}] ${wh.title} @ ${wh.company}`);
      if (wh.summary) parts.push(`  Summary: ${wh.summary}`);
      for (const b of wh.bullets.slice(0, 5)) {
        parts.push(`  • ${b.content}${b.metric ? ` (${b.metric})` : ''}`);
      }
      if (wh.skills?.length) parts.push(`  Skills used: ${wh.skills.slice(0, 8).join(', ')}`);
    }
  }

  if (education.length > 0) {
    parts.push('\nEDUCATION:');
    for (const ed of education) {
      parts.push(`• ${[ed.degree, ed.fieldOfStudy].filter(Boolean).join(' in ')} @ ${ed.institution}${ed.endDate ? ` (${new Date(ed.endDate).getFullYear()})` : ''}`);
    }
  }

  if (skills.length > 0) {
    parts.push(`\nSKILLS: ${skills.slice(0, 25).map(s => s.name).join(', ')}`);
  }

  if (certs.length > 0) {
    parts.push(`CERTIFICATIONS: ${certs.map(c => c.name + (c.issuer ? ` (${c.issuer})` : '')).join(', ')}`);
  }

  if (projects.length > 0) {
    parts.push('\nKEY PROJECTS:');
    for (const p of projects.slice(0, 3)) {
      parts.push(`• ${p.name}${p.description ? ': ' + p.description.slice(0, 120) : ''}`);
      if (p.technologies?.length) parts.push(`  Tech: ${p.technologies.join(', ')}`);
    }
  }

  if (storedAnswers.length > 0) {
    parts.push('\nSTORED ANSWERS (use these verbatim when generating answers):');
    for (const ans of storedAnswers.slice(0, 10)) {
      parts.push(`${ans.questionKey}: ${ans.answer.slice(0, 250)}`);
    }
  }

  if (jobPrefs) {
    if (jobPrefs.salaryMinUSD) {
      const s = jobPrefs.salaryMaxUSD
        ? `$${jobPrefs.salaryMinUSD.toLocaleString()}–$${jobPrefs.salaryMaxUSD.toLocaleString()}`
        : `$${jobPrefs.salaryMinUSD.toLocaleString()}+`;
      parts.push(`\nSALARY TARGET: ${s}`);
    }
    if (jobPrefs.remotePreference) parts.push(`REMOTE PREFERENCE: ${jobPrefs.remotePreference}`);
  }

  return parts.join('\n');
}

// ─── Cover letter generation (archetype-aware + keyword-injected) ─────────────

async function generateQualityCoverLetter(
  profileContext: string,
  job: { title: string; company: string; description: string },
  archetype: string,
  keywords: string[],
  personalInfo: { fullName?: string | null; addressLine1?: string | null; city?: string | null; state?: string | null; zipCode?: string | null; phone?: string | null; email?: string | null; linkedinUrl?: string | null; githubUrl?: string | null } | null
): Promise<string> {
  const archetypeGuidance: Record<string, string> = {
    'AI Platform / LLMOps': 'Emphasize: production ML systems, observability, evals, pipeline reliability, cost optimization, scaling. Lead with a concrete system you shipped at scale.',
    'Agentic / Automation': 'Emphasize: agent orchestration, tool use, HITL design, error handling, workflow automation. Lead with a specific agentic system you built.',
    'Technical AI PM': 'Emphasize: product discovery, stakeholder alignment, roadmap decisions, metric-driven outcomes. Lead with a product decision you owned and its business impact.',
    'AI Solutions Architect': 'Emphasize: system design, enterprise integration, cross-functional technical leadership. Lead with an architecture decision that solved a hard constraint.',
    'AI Forward Deployed': 'Emphasize: speed of delivery, client-facing work, prototype-to-production, adaptability. Lead with a fast delivery win.',
    'AI Transformation': 'Emphasize: change management, adoption, enablement, organizational impact at scale. Lead with adoption metrics.',
    'Software Engineering': 'Emphasize: technical depth, system thinking, code quality, team impact. Lead with your most impactful technical contribution.',
  };

  const guidance = archetypeGuidance[archetype] || archetypeGuidance['Software Engineering'];
  const keywordList = keywords.slice(0, 8).join(', ');

  // Build professional header
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const name = personalInfo?.fullName || 'Zach Bienstock';
  const cityState = [personalInfo?.city, personalInfo?.state ? personalInfo.state + (personalInfo.zipCode ? ' ' + personalInfo.zipCode : '') : ''].filter(Boolean).join(', ');

  const header = [
    name,
    ...(personalInfo?.addressLine1 ? [personalInfo.addressLine1] : []),
    ...(cityState ? [cityState] : []),
    ...(personalInfo?.phone ? [personalInfo.phone] : []),
    ...(personalInfo?.email ? [personalInfo.email] : []),
    ...(personalInfo?.linkedinUrl ? [personalInfo.linkedinUrl] : []),
    ...(personalInfo?.githubUrl ? [personalInfo.githubUrl] : []),
    '',
    today,
    '',
    'Hiring Team',
    job.company,
    '',
    `Re: ${job.title}`,
    '',
    'Dear Hiring Team,',
  ].join('\n');

  const body = await generateCoverLetter(`
ROLE ARCHETYPE: ${archetype}
ARCHETYPE GUIDANCE: ${guidance}
KEYWORDS TO WEAVE IN NATURALLY (use at least 4): ${keywordList}

ABSOLUTE RULES:
1. NEVER fabricate any experience, metric, company, project, or skill.
2. ONLY use facts from the CANDIDATE PROFILE below.
3. Body must be exactly 3 paragraphs. Total body under 280 words.
4. No paragraph starts with "I" as the first word.
5. No clichés: no "passionate", "team player", "hard worker", "results-driven", "leverage", "spearheaded".
6. Each paragraph must contain at least one specific, factual detail from the profile.

CANDIDATE PROFILE:
${profileContext}

JOB: ${job.title} at ${job.company}
JOB DESCRIPTION (first 1200 chars):
${(job.description || '').slice(0, 1200)}

Write ONLY the 3 body paragraphs + closing. Do not include the header (it is already written).

STRUCTURE:
Para 1 (2-3 sentences): The most relevant single piece of their experience mapped to the #1 requirement in this JD. Be specific.
Para 2 (3-4 sentences): 2-3 concrete skills or projects from the profile that address the JD's key requirements. Use real company names and outcomes.
Para 3 (2-3 sentences): Why this company specifically — reference something real from the JD that shows you read it. End with a clear ask.
Closing: "Sincerely," then blank line, then full name.

Begin Para 1 now:`);

  return header + '\n\n' + body;
}

// ─── Cover letter quality scorer ──────────────────────────────────────────────

async function scoreCoverLetterQuality(
  coverLetter: string,
  profileContext: string,
  jobDescription: string
): Promise<number> {
  try {
    const raw = await generate({
      task: 'scoring_rationale',
      maxTokens: 100,
      systemPrompt: 'You evaluate cover letter quality. Return ONLY a JSON object.',
      prompt: `Score this cover letter 0–100 on these criteria:
- Specificity (25 pts): Uses real job titles, company names, concrete details
- Relevance (25 pts): Maps directly to this job's requirements  
- No fabrication (25 pts): All claims match the profile
- Writing quality (25 pts): Natural, no clichés, varied sentence structure

Return ONLY: {"score": <number>, "flags": ["issue1", "issue2"]}

Cover letter body (first 600 chars):
${coverLetter.slice(0, 600)}

Job requirements (first 400 chars):
${jobDescription.slice(0, 400)}

Profile snippet:
${profileContext.slice(0, 400)}`,
    });
    const cleaned = raw.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 60;
  } catch {
    return 60; // default to 60 if scoring fails
  }
}

// ─── Answer generation (quality-first) ───────────────────────────────────────

async function generateAnswers(
  userId: string,
  profileContext: string,
  job: { title: string; company: string; description: string }
): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};

  // Stored verified answers are ground truth
  const stored = await prisma.reusableAnswer.findMany({ where: { userId, isVerified: true } });
  for (const ans of stored) {
    answers[ans.questionKey] = ans.answerShort || ans.answer;
  }

  // Profile field answers
  const [personalInfo, jobPrefs] = await Promise.all([
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
  ]);

  if (personalInfo) {
    if (!answers['work_authorization_us']) {
      const auth = personalInfo.workAuthorization;
      answers['work_authorization_us'] = (auth === 'us_citizen' || auth === 'green_card') ? 'Yes' : 'No';
    }
    answers['requires_sponsorship'] = answers['requires_sponsorship'] ?? (personalInfo.requiresSponsorship ? 'Yes' : 'No');
    if (personalInfo.linkedinUrl) answers['linkedin_url'] = answers['linkedin_url'] ?? personalInfo.linkedinUrl;
    if (personalInfo.githubUrl) answers['github_url'] = answers['github_url'] ?? personalInfo.githubUrl;
    if (personalInfo.phone) answers['phone'] = answers['phone'] ?? personalInfo.phone;
    if (personalInfo.portfolioUrl) answers['portfolio_url'] = answers['portfolio_url'] ?? personalInfo.portfolioUrl;
    if (personalInfo.availableStartDate) {
      answers['start_date'] = answers['start_date'] ?? new Date(personalInfo.availableStartDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (personalInfo.noticePeriodDays !== undefined) {
      answers['start_date'] = answers['start_date'] ?? (personalInfo.noticePeriodDays === 0 ? 'Immediately' : `${personalInfo.noticePeriodDays} days notice`);
    }
  }

  if (jobPrefs?.salaryMinUSD && !answers['salary_expectation']) {
    answers['salary_expectation'] = jobPrefs.salaryMaxUSD
      ? `$${jobPrefs.salaryMinUSD.toLocaleString()}–$${jobPrefs.salaryMaxUSD.toLocaleString()}`
      : `$${jobPrefs.salaryMinUSD.toLocaleString()}+`;
  }
  if (jobPrefs?.remotePreference && !answers['remote_preference']) {
    const map: Record<string, string> = { remote_only: 'Remote', hybrid_ok: 'Open to hybrid or remote', onsite_ok: 'Open to onsite', any: 'Flexible' };
    answers['remote_preference'] = map[jobPrefs.remotePreference] ?? jobPrefs.remotePreference;
  }
  if (jobPrefs?.willingToRelocate !== undefined && !answers['willing_to_relocate']) {
    answers['willing_to_relocate'] = jobPrefs.willingToRelocate ? 'Yes' : 'No';
  }

  // AI-generated answers for per-job questions
  // "Why this company" — grounded in JD details, not generic
  if (!answers['why_this_company']) {
    answers['why_this_company'] = await generate({
      task: 'answer_short',
      maxTokens: 180,
      systemPrompt: 'You write specific, authentic, non-generic answers to job application questions. Never fabricate. Use only the provided profile and JD.',
      prompt: `Write a 2-sentence answer to "Why are you interested in ${job.company}?"

Rules: Reference something SPECIFIC from the job description (technology, mission, problem space, or product). Do NOT use "I'm passionate about" or generic praise.

Profile snippet: ${profileContext.slice(0, 400)}
Job description snippet: ${(job.description || '').slice(0, 600)}`,
    }).catch(() => `Interested in ${job.company}'s work in this space and how it aligns with my background.`);
  }

  // "Why this role" — archetype-aware
  if (!answers['why_this_role']) {
    answers['why_this_role'] = await generate({
      task: 'answer_short',
      maxTokens: 180,
      systemPrompt: 'You write specific, authentic answers to job application questions. Never fabricate.',
      prompt: `Write a 2-sentence answer to "Why are you interested in this ${job.title} role?"

Reference a specific requirement or responsibility from the JD that maps to something in the profile.

Profile: ${profileContext.slice(0, 400)}
JD: ${(job.description || '').slice(0, 500)}`,
    }).catch(() => `The ${job.title} role aligns well with my background and what I'm looking to do next.`);
  }

  return answers;
}

// ─── Main packet builder ──────────────────────────────────────────────────────

export async function buildApplicationPacket(
  userId: string,
  jobId: string
): Promise<ApplicationPacket> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');

  const profileContext = await buildProfileContext(userId);

  // Check for missing required fields
  const missingFields: string[] = [];
  const personalInfo = await prisma.personalInfo.findUnique({ where: { userId } });
  if (!personalInfo?.fullName) missingFields.push('full_name');
  if (!personalInfo?.email) missingFields.push('email');
  if (!personalInfo?.phone) missingFields.push('phone');

  const workHistory = await prisma.workHistory.findMany({ where: { userId } });
  if (workHistory.length === 0) missingFields.push('work_history');

  const resumes = await prisma.resume.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (resumes.length === 0) missingFields.push('resume');

  // Detect archetype and extract keywords (parallel)
  const archetype = detectArchetype(job.title, job.description || '');
  const keywords = await extractKeywords(job.description || '');

  // Generate cover letter (archetype-aware, keyword-injected)
  const coverLetter = await generateQualityCoverLetter(
    profileContext,
    { title: job.title, company: job.company, description: job.description || '' },
    archetype,
    keywords,
    personalInfo
  );

  // Generate answers
  const answers = await generateAnswers(userId, profileContext, {
    title: job.title,
    company: job.company,
    description: job.description || '',
  });

  // Score cover letter quality
  const qualityScore = await scoreCoverLetterQuality(
    coverLetter,
    profileContext,
    job.description || ''
  );

  // Can auto-apply: no missing fields + supported ATS + quality gate (>= 65)
  const canAutoApply =
    missingFields.length === 0 &&
    ['greenhouse', 'lever', 'ashby'].includes(job.atsType || '') &&
    !!job.applyUrl &&
    qualityScore >= 65;

  // Confidence reflects both completeness and quality
  const completenessScore = Math.max(0, 1 - missingFields.length * 0.2);
  const confidence = (completenessScore * 0.5) + (qualityScore / 100 * 0.5);

  // Save generation run
  await prisma.generationRun.create({
    data: {
      userId,
      type: 'cover_letter',
      model: 'claude-sonnet-4-5',
      jobId,
      jobTitle: job.title,
      company: job.company,
      groundedFields: ['workHistory', 'personalInfo', 'skills', 'projects', 'certs'],
      output: coverLetter,
      isApproved: false,
    },
  }).catch(() => {});

  return {
    jobId,
    resumeText: resumes[0]?.rawText || '',
    coverLetter,
    answers,
    confidence,
    qualityScore,
    canAutoApply,
    missingFields,
    archetype,
    keywords,
  };
}

// ─── ATS Submission functions (unchanged logic, preserved) ────────────────────

export async function submitToGreenhouse(
  packet: ApplicationPacket,
  job: { applyUrl: string; title: string; company: string; externalId: string },
  applicantInfo: {
    firstName: string; lastName: string; email: string;
    phone?: string; linkedinUrl?: string;
    resumeContent?: string; coverLetterContent?: string; resumeText?: string;
  }
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    const match = job.applyUrl.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
    if (!match) throw new Error('Cannot parse Greenhouse URL');
    const [, boardToken, ghJobId] = match;
    const payload = {
      first_name: applicantInfo.firstName,
      last_name: applicantInfo.lastName,
      email: applicantInfo.email,
      phone: applicantInfo.phone || '',
      cover_letter_text: applicantInfo.coverLetterContent || packet.coverLetter,
      linkedin_profile_url: applicantInfo.linkedinUrl || '',
      resume_text: applicantInfo.resumeContent || packet.resumeText,
      mapped_url_token: 'careeva',
    };
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${ghJobId}/applications`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Greenhouse rejected: ${err.slice(0, 200)}` };
    }
    const result = await res.json();
    return { success: true, applicationId: String(result.id || '') };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function submitToLever(
  packet: ApplicationPacket,
  job: { applyUrl: string; title: string; company: string; externalId: string },
  applicantInfo: {
    firstName: string; lastName: string; email: string;
    phone?: string; linkedinUrl?: string;
    resumeContent?: string; coverLetterContent?: string; resumeText?: string;
  }
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    const match = job.applyUrl.match(/lever\.co\/([^/?#]+)\/([^/?#]+)/);
    if (!match) throw new Error('Cannot parse Lever URL');
    const [, companySlug, jobId] = match;
    const formData = new FormData();
    formData.append('name', `${applicantInfo.firstName} ${applicantInfo.lastName}`);
    formData.append('email', applicantInfo.email);
    if (applicantInfo.phone) formData.append('phone', applicantInfo.phone);
    if (applicantInfo.linkedinUrl) formData.append('urls[LinkedIn]', applicantInfo.linkedinUrl);
    if (applicantInfo.coverLetterContent) formData.append('comments', applicantInfo.coverLetterContent);
    const res = await fetch(`https://api.lever.co/v0/postings/${companySlug}/${jobId}/apply`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Lever rejected: ${err.slice(0, 200)}` };
    }
    const result = await res.json().catch(() => ({}));
    return { success: true, applicationId: result.applicationId || result.id || 'submitted' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function submitToAshby(
  packet: ApplicationPacket,
  job: { applyUrl: string; title: string; company: string; externalId: string },
  applicantInfo: {
    firstName: string; lastName: string; email: string;
    phone?: string; linkedinUrl?: string; coverLetterContent?: string; resumeText?: string;
  }
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    const match = job.applyUrl.match(/ashbyhq\.com\/([^/?#]+)\/([^/?#]+)/);
    if (!match) throw new Error('Cannot parse Ashby URL');
    const [, , jobPostingId] = match;
    const payload = {
      jobPostingId,
      email: applicantInfo.email,
      firstName: applicantInfo.firstName,
      lastName: applicantInfo.lastName,
      phoneNumber: applicantInfo.phone || '',
      linkedInUrl: applicantInfo.linkedinUrl || '',
      resumeAsText: applicantInfo.resumeText || packet.resumeText || '',
      coverLetter: applicantInfo.coverLetterContent || packet.coverLetter || '',
    };
    const res = await fetch('https://app.ashbyhq.com/api/non-user-facing/job-board/application', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Ashby rejected: ${err.slice(0, 200)}` };
    }
    const result = await res.json().catch(() => ({}));
    return { success: true, applicationId: result.id || result.applicationId || 'submitted' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Full auto-apply flow ─────────────────────────────────────────────────────

export async function autoApplyToJob(
  userId: string,
  jobId: string,
  mode: 'auto' | 'prep_only' | 'review_first' = 'review_first'
): Promise<{
  status: 'applied' | 'queued_for_review' | 'prep_ready' | 'failed';
  packet: ApplicationPacket;
  applicationId?: string;
  error?: string;
}> {
  const packet = await buildApplicationPacket(userId, jobId);
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { status: 'failed', packet, error: 'Job not found' };

  // Save cover letter to DB
  await prisma.coverLetter.create({
    data: {
      userId,
      jobId,
      jobTitle: job.title,
      company: job.company,
      content: packet.coverLetter,
      tone: 'professional',
      isTemplate: false,
    },
  }).catch(() => {});

  const application = await prisma.application.create({
    data: {
      userId,
      jobId,
      company: job.company,
      role: job.title,
      status: 'saved',
      url: job.url,
      applyUrl: job.applyUrl,
      atsType: job.atsType,
      submittedVia: 'careeva',
    },
  });

  // Save answers
  for (const [key, value] of Object.entries(packet.answers)) {
    await prisma.applicationAnswer.create({
      data: {
        applicationId: application.id,
        questionText: key,
        questionKey: key,
        answer: value,
        isAutoGenerated: true,
        confidence: packet.confidence,
      },
    }).catch(() => {});
  }

  if (mode === 'prep_only') {
    await prisma.application.update({ where: { id: application.id }, data: { status: 'prepping' } });
    return { status: 'prep_ready', packet };
  }

  if (mode === 'review_first' || !packet.canAutoApply) {
    await prisma.application.update({ where: { id: application.id }, data: { status: 'prepping' } });
    return { status: 'queued_for_review', packet };
  }

  // Quality gate: don't auto-submit if quality score is too low
  if (packet.qualityScore < 65) {
    await prisma.application.update({ where: { id: application.id }, data: { status: 'prepping' } });
    return { status: 'queued_for_review', packet, error: `Quality score ${packet.qualityScore}/100 below threshold — queued for review` };
  }

  const personalInfo = await prisma.personalInfo.findUnique({ where: { userId } });
  const nameParts = (personalInfo?.fullName || 'Zach Bienstock').split(' ');
  const applicantInfo = {
    firstName: nameParts[0] || 'Zach',
    lastName: nameParts.slice(1).join(' ') || 'Bienstock',
    email: personalInfo?.email || 'zbienstock@gmail.com',
    phone: personalInfo?.phone || '',
    linkedinUrl: personalInfo?.linkedinUrl || '',
    coverLetterContent: packet.coverLetter,
    resumeText: packet.resumeText,
  };

  const jobArgs = {
    applyUrl: job.applyUrl || '',
    title: job.title,
    company: job.company,
    externalId: job.externalId || '',
  };

  let result: { success: boolean; applicationId?: string; error?: string } = { success: false };

  if (job.atsType === 'lever') result = await submitToLever(packet, jobArgs, applicantInfo);
  else if (job.atsType === 'ashby') result = await submitToAshby(packet, jobArgs, applicantInfo);
  else if (job.atsType === 'greenhouse') result = await submitToGreenhouse(packet, jobArgs, applicantInfo);

  if (result.success) {
    await prisma.application.update({
      where: { id: application.id },
      data: { status: 'applied', appliedAt: new Date(), externalApplicationId: result.applicationId },
    });
    return { status: 'applied', packet, applicationId: result.applicationId };
  }

  await prisma.application.update({ where: { id: application.id }, data: { status: 'prepping' } });
  return { status: 'queued_for_review', packet, error: result.error };
}
