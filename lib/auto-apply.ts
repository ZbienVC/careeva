/**
 * lib/auto-apply.ts
 * Application packet generator + direct ATS submission
 * 
 * For personal use - optimized for Zach's job search
 * Supports: Greenhouse (API apply), Lever (API apply), Generic (queue for review)
 */

import { prisma } from '@/lib/prisma';
import { generateCoverLetter, generateBehavioralAnswer, generateShortAnswer, isAIConfigured } from '@/lib/ai-client';

// AI calls use the shared ai-client which routes to Claude or GPT based on task

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationPacket {
  jobId: string;
  resumeText: string;
  coverLetter: string;
  answers: Record<string, string>;  // questionKey -> answer
  confidence: number;               // 0-1, overall confidence we can auto-submit
  canAutoApply: boolean;
  missingFields: string[];
}

// ─── Step 1: Build profile context ───────────────────────────────────────────

async function buildProfileContext(userId: string): Promise<string> {
  const [
    personalInfo,
    workHistory,
    education,
    skills,
    jobPrefs,
    writingPrefs,
    storedAnswers,
  ] = await Promise.all([
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, include: { bullets: true }, orderBy: { startDate: 'desc' } }),
    prisma.educationEntry.findMany({ where: { userId }, orderBy: { endDate: 'desc' } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
    prisma.writingPreferences.findUnique({ where: { userId } }),
    prisma.reusableAnswer.findMany({ where: { userId, isVerified: true } }),
  ]);

  const parts: string[] = [];

  if (personalInfo) {
    parts.push(`NAME: ${personalInfo.fullName || 'Zach Bienstock'}`);
    parts.push(`EMAIL: ${personalInfo.email || 'zbienstock@gmail.com'}`);
    parts.push(`PHONE: ${personalInfo.phone || ''}`);
    parts.push(`LOCATION: ${[personalInfo.city, personalInfo.state].filter(Boolean).join(', ')}`);
    parts.push(`LINKEDIN: ${personalInfo.linkedinUrl || ''}`);
    parts.push(`GITHUB: ${personalInfo.githubUrl || ''}`);
    parts.push(`WORK_AUTH: ${personalInfo.workAuthorization || 'us_citizen'}`);
    parts.push(`SPONSORSHIP_NEEDED: ${personalInfo.requiresSponsorship ? 'Yes' : 'No'}`);
  }

  if (workHistory.length > 0) {
    parts.push('\nWORK HISTORY:');
    for (const wh of workHistory.slice(0, 5)) {
      const start = wh.startDate ? new Date(wh.startDate).getFullYear() : '';
      const end = wh.isCurrent ? 'Present' : (wh.endDate ? new Date(wh.endDate).getFullYear() : '');
      parts.push(`- ${wh.title} @ ${wh.company} (${start}-${end})`);
      if (wh.summary) parts.push(`  ${wh.summary}`);
      for (const bullet of wh.bullets.slice(0, 3)) {
        parts.push(`  • ${bullet.content}`);
      }
    }
  }

  if (education.length > 0) {
    parts.push('\nEDUCATION:');
    for (const ed of education) {
      parts.push(`- ${ed.degree || ''} ${ed.fieldOfStudy || ''} @ ${ed.institution}`);
    }
  }

  if (skills.length > 0) {
    const skillNames = skills.slice(0, 20).map(s => s.name).join(', ');
    parts.push(`\nSKILLS: ${skillNames}`);
  }

  if (jobPrefs) {
    if (jobPrefs.salaryMinUSD) parts.push(`SALARY_MIN: $${jobPrefs.salaryMinUSD.toLocaleString()}`);
    if (jobPrefs.remotePreference) parts.push(`REMOTE_PREF: ${jobPrefs.remotePreference}`);
  }

  if (storedAnswers.length > 0) {
    parts.push('\nSTORED ANSWERS:');
    for (const ans of storedAnswers.slice(0, 15)) {
      parts.push(`${ans.questionKey}: ${ans.answer.slice(0, 200)}`);
    }
  }

  return parts.join('\n');
}

// ─── Step 2: Generate cover letter ───────────────────────────────────────────

async function buildAndGenerateCoverLetter(
  profileContext: string,
  job: { title: string; company: string; description: string },
  tone = 'professional'
): Promise<string> {
  const prompt = `You are writing a cover letter for a job application. Write in a ${tone}, authentic, human voice. Be concise (3 paragraphs max). Do NOT fabricate experience - only use what's in the profile.

PROFILE:
${profileContext}

JOB: ${job.title} at ${job.company}
JOB DESCRIPTION (first 1500 chars): ${job.description.slice(0, 1500)}

Write a complete, ready-to-send cover letter. No placeholders. Address it to "Hiring Team" if no specific name available.`;

  return generateCoverLetter(prompt);
}

// ─── Step 3: Generate answers for common questions ────────────────────────────

async function generateAnswers(
  userId: string,
  profileContext: string,
  job: { title: string; company: string; description: string }
): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};

  // Get stored verified answers first (these are ground truth)
  const stored = await prisma.reusableAnswer.findMany({ where: { userId, isVerified: true } });
  for (const ans of stored) {
    answers[ans.questionKey] = ans.answerShort || ans.answer;
  }

  // Default answers from profile
  const personalInfo = await prisma.personalInfo.findUnique({ where: { userId } });
  const jobPrefs = await prisma.jobPreferences.findUnique({ where: { userId } });

  if (personalInfo) {
    if (!answers['work_authorization_us']) {
      const auth = personalInfo.workAuthorization;
      answers['work_authorization_us'] = (auth === 'us_citizen' || auth === 'green_card') ? 'Yes' : 'No';
    }
    if (!answers['requires_sponsorship']) {
      answers['requires_sponsorship'] = personalInfo.requiresSponsorship ? 'Yes' : 'No';
    }
    if (!answers['linkedin_url'] && personalInfo.linkedinUrl) {
      answers['linkedin_url'] = personalInfo.linkedinUrl;
    }
    if (!answers['github_url'] && personalInfo.githubUrl) {
      answers['github_url'] = personalInfo.githubUrl;
    }
    if (!answers['phone'] && personalInfo.phone) {
      answers['phone'] = personalInfo.phone;
    }
  }

  if (jobPrefs) {
    if (!answers['salary_expectation'] && jobPrefs.salaryMinUSD) {
      const max = jobPrefs.salaryMaxUSD;
      answers['salary_expectation'] = max
        ? `$${jobPrefs.salaryMinUSD.toLocaleString()} – $${max.toLocaleString()}`
        : `$${jobPrefs.salaryMinUSD.toLocaleString()}+`;
    }
    if (!answers['remote_preference'] && jobPrefs.remotePreference) {
      const map: Record<string, string> = {
        remote_only: 'Remote preferred',
        hybrid_ok: 'Open to hybrid or remote',
        any: 'Flexible',
      };
      answers['remote_preference'] = map[jobPrefs.remotePreference] || jobPrefs.remotePreference;
    }
    if (!answers['willing_to_relocate']) {
      answers['willing_to_relocate'] = jobPrefs.willingToRelocate ? 'Yes' : 'No';
    }
  }

  // Generate answers for behavioral questions using AI
  if (!answers['why_this_company']) {
    answers['why_this_company'] = await generateShortAnswer(
      `In 2-3 sentences, explain why this candidate is interested in ${job.company} for a ${job.title} role. Be specific but authentic. Profile: ${profileContext.slice(0, 500)}`
    ).catch(() => '');
  }

  return answers;
}

// ─── Step 4: Main packet builder ─────────────────────────────────────────────

export async function buildApplicationPacket(
  userId: string,
  jobId: string
): Promise<ApplicationPacket> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');

  const profileContext = await buildEnrichedProfileContext(userId);

  // Check what's missing
  const missingFields: string[] = [];
  const personalInfo = await prisma.personalInfo.findUnique({ where: { userId } });
  if (!personalInfo?.fullName) missingFields.push('full_name');
  if (!personalInfo?.email) missingFields.push('email');
  if (!personalInfo?.phone) missingFields.push('phone');

  const workHistory = await prisma.workHistory.findMany({ where: { userId } });
  if (workHistory.length === 0) missingFields.push('work_history');

  const resumes = await prisma.resume.findMany({ where: { userId } });
  if (resumes.length === 0) missingFields.push('resume');

  // Build cover letter via Claude (ai-client routes to Claude Sonnet 4.6 or GPT fallback)
  const [coverLetter, answers] = await Promise.all([
    buildAndGenerateCoverLetter(profileContext, { title: job.title, company: job.company, description: job.description || '' }),
    generateAnswers(userId, profileContext, { title: job.title, company: job.company, description: job.description }),
  ]);

  // Determine if we can auto-apply
  const canAutoApply = missingFields.length === 0 &&
    (job.atsType === 'greenhouse' || job.atsType === 'lever') &&
    !!job.applyUrl;  // Greenhouse + Lever: direct API submission

  const confidence = Math.max(0, 1 - (missingFields.length * 0.2));

  // Save generation run
  await prisma.generationRun.create({
    data: {
      userId,
      type: 'cover_letter',
      model: 'gpt-4o-mini',
      jobId,
      jobTitle: job.title,
      company: job.company,
      groundedFields: ['workHistory', 'personalInfo', 'skills'],
      output: coverLetter,
      isApproved: false,
    },
  }).catch(() => {}); // non-fatal

  return {
    jobId,
    resumeText: resumes[0]?.rawText || '',
    coverLetter,
    answers,
    confidence,
    canAutoApply,
    missingFields,
  };
}

// ─── Step 5: Submit to Greenhouse (direct API) ────────────────────────────────

export async function submitToGreenhouse(
  packet: ApplicationPacket,
  job: { applyUrl: string; title: string; company: string; externalId: string },
  applicantInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    linkedinUrl?: string;
    resumeContent?: string;
    coverLetterContent?: string;
    resumeText?: string;
  }
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  try {
    // Extract board token from URL: boards.greenhouse.io/{board_token}/jobs/{job_id}
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
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
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


// ─── Enhanced profile context builder ────────────────────────────────────────
// Upgrades the base buildProfileContext with all structured data models

async function buildEnrichedProfileContext(userId: string): Promise<string> {
  const base = await buildProfileContext(userId);
  
  // Add structured work history bullets
  const whWithBullets = await prisma.workHistory.findMany({
    where: { userId },
    include: { bullets: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { startDate: 'desc' },
  });
  
  // Add certifications
  const certs = await prisma.certification.findMany({ where: { userId } });
  
  // Add projects
  const projects = await prisma.project.findMany({ where: { userId }, include: { bullets: true } });
  
  const parts: string[] = [base];
  
  // Rich work bullets
  if (whWithBullets.some(wh => wh.bullets.length > 0)) {
    parts.push('\nDETAILED EXPERIENCE BULLETS:');
    for (const wh of whWithBullets.slice(0, 4)) {
      if (wh.bullets.length > 0) {
        parts.push(`\n${wh.title} @ ${wh.company}:`);
        for (const b of wh.bullets.slice(0, 5)) {
          parts.push(`  • ${b.content}${b.metric ? ` (${b.metric})` : ''}`);
        }
      }
    }
  }
  
  if (certs.length > 0) {
    parts.push('\nCERTIFICATIONS:');
    for (const c of certs) {
      parts.push(`- ${c.name}${c.issuer ? ` (${c.issuer})` : ''}${c.issueDate ? ` - ${new Date(c.issueDate).getFullYear()}` : ''}`);
    }
  }
  
  if (projects.length > 0) {
    parts.push('\nKEY PROJECTS:');
    for (const p of projects.slice(0, 3)) {
      parts.push(`- ${p.name}${p.description ? `: ${p.description.slice(0, 100)}` : ''}`);
      if (p.technologies.length > 0) parts.push(`  Tech: ${p.technologies.join(', ')}`);
    }
  }
  
  return parts.join('\n');
}

// ─── Submit to Lever (public apply API) ──────────────────────────────────────

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
    // Extract company slug from URL: jobs.lever.co/{slug}/{job-id}
    const match = job.applyUrl.match(/lever\.co\/([^/?#]+)\/([^/?#]+)/);
    if (!match) throw new Error('Cannot parse Lever URL');
    const [, companySlug, jobId] = match;

    const formData = new FormData();
    formData.append('name', `${applicantInfo.firstName} ${applicantInfo.lastName}`);
    formData.append('email', applicantInfo.email);
    if (applicantInfo.phone) formData.append('phone', applicantInfo.phone);
    if (applicantInfo.linkedinUrl) formData.append('urls[LinkedIn]', applicantInfo.linkedinUrl);
    if (applicantInfo.coverLetterContent) {
      formData.append('comments', applicantInfo.coverLetterContent);
    }

    const res = await fetch(
      `https://api.lever.co/v0/postings/${companySlug}/${jobId}/apply`,
      { method: 'POST', body: formData }
    );

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
// ─── Step 6: Full auto-apply flow ─────────────────────────────────────────────

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

  // Create application record
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

  // Save answers to application
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

  // Auto-submit for Lever
  if (job.atsType === 'lever' && packet.canAutoApply) {
    const personalInfo2 = await prisma.personalInfo.findUnique({ where: { userId } });
    const nameParts2 = (personalInfo2?.fullName || 'Zach Bienstock').split(' ');
    const leverResult = await submitToLever(
      packet,
      { applyUrl: job.applyUrl || '', title: job.title, company: job.company, externalId: job.externalId || '' },
      {
        firstName: nameParts2[0] || 'Zach',
        lastName: nameParts2.slice(1).join(' ') || 'Bienstock',
        email: personalInfo2?.email || 'zbienstock@gmail.com',
        phone: personalInfo2?.phone || '',
        linkedinUrl: personalInfo2?.linkedinUrl || '',
        coverLetterContent: packet.coverLetter,
      }
    );
    if (leverResult.success) {
      await prisma.application.update({
        where: { id: application.id },
        data: { status: 'applied', appliedAt: new Date(), externalApplicationId: leverResult.applicationId },
      });
      return { status: 'applied', packet, applicationId: leverResult.applicationId };
    }
  }

  // Auto-submit for Greenhouse
  if (job.atsType === 'greenhouse' && packet.canAutoApply) {
    const personalInfo = await prisma.personalInfo.findUnique({ where: { userId } });
    const nameParts = (personalInfo?.fullName || 'Zach Bienstock').split(' ');

    const result = await submitToGreenhouse(
      packet,
      { applyUrl: job.applyUrl || '', title: job.title, company: job.company, externalId: job.externalId || '' },
      {
        firstName: nameParts[0] || 'Zach',
        lastName: nameParts.slice(1).join(' ') || 'Bienstock',
        email: personalInfo?.email || 'zbienstock@gmail.com',
        phone: personalInfo?.phone || '',
        linkedinUrl: personalInfo?.linkedinUrl || '',
        coverLetterContent: packet.coverLetter,
        resumeText: packet.resumeText,
      }
    );

    if (result.success) {
      await prisma.application.update({
        where: { id: application.id },
        data: { status: 'applied', appliedAt: new Date(), externalApplicationId: result.applicationId },
      });
      return { status: 'applied', packet, applicationId: result.applicationId };
    } else {
      await prisma.application.update({ where: { id: application.id }, data: { status: 'prepping' } });
      return { status: 'queued_for_review', packet, error: result.error };
    }
  }

  await prisma.application.update({ where: { id: application.id }, data: { status: 'prepping' } });
  return { status: 'queued_for_review', packet };
}
