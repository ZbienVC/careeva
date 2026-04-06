import { generateCoverLetter, isAIConfigured, getActiveAIProvider } from '@/lib/ai-client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobDescription, jobTitle, company, hiringManager, tone = 'professional', jobId } = await req.json();

    if (!isAIConfigured()) return NextResponse.json({ error: 'No AI API key configured. Add ANTHROPIC_API_KEY (Claude) or OPENAI_API_KEY to your environment.' }, { status: 500 });
    if (!jobTitle || !company) return NextResponse.json({ error: 'jobTitle and company required' }, { status: 400 });

    // Fetch full profile for rich context
    const [personalInfo, workHistory, skills, education, certs, projects, writingPrefs, storedAnswers] = await Promise.all([
      prisma.personalInfo.findUnique({ where: { userId: user.id } }),
      prisma.workHistory.findMany({ where: { userId: user.id }, include: { bullets: true }, orderBy: { startDate: 'desc' } }),
      prisma.skill.findMany({ where: { userId: user.id }, take: 30 }),
      prisma.educationEntry.findMany({ where: { userId: user.id } }),
      prisma.certification.findMany({ where: { userId: user.id } }),
      prisma.project.findMany({ where: { userId: user.id }, include: { bullets: true }, take: 3 }),
      prisma.writingPreferences.findUnique({ where: { userId: user.id } }),
      prisma.reusableAnswer.findMany({ where: { userId: user.id, isVerified: true }, take: 10 }),
    ]);

    // Build rich profile context
    const name = personalInfo?.fullName || user.name || 'The candidate';
    const toneWords = writingPrefs?.toneWords?.join(', ') || 'professional, authentic, concise';
    const avoidWords = writingPrefs?.avoidWords?.join(', ') || 'synergy, leverage, utilize, passionate';
    const posStatement = writingPrefs?.positioningStatement || '';

    let profileContext = `CANDIDATE: ${name}\n`;
    if (personalInfo?.linkedinUrl) profileContext += `LinkedIn: ${personalInfo.linkedinUrl}\n`;
    if (personalInfo?.githubUrl) profileContext += `GitHub: ${personalInfo.githubUrl}\n`;

    if (workHistory.length > 0) {
      profileContext += '\nWORK EXPERIENCE:\n';
      for (const wh of workHistory.slice(0, 4)) {
        const start = wh.startDate ? new Date(wh.startDate).getFullYear() : '';
        const end = wh.isCurrent ? 'Present' : (wh.endDate ? new Date(wh.endDate).getFullYear() : '');
        profileContext += `\n${wh.title} @ ${wh.company} (${start}–${end})\n`;
        if (wh.summary) profileContext += `Summary: ${wh.summary}\n`;
        for (const b of wh.bullets.slice(0, 4)) {
          profileContext += `• ${b.content}${b.metric ? ` (${b.metric})` : ''}\n`;
        }
        if (wh.skills?.length) profileContext += `Skills: ${wh.skills.join(', ')}\n`;
      }
    }

    if (education.length > 0) {
      profileContext += '\nEDUCATION: ';
      profileContext += education.map(e => `${e.degree || ''} ${e.fieldOfStudy || ''} at ${e.institution}`).join(' | ') + '\n';
    }

    if (skills.length > 0) {
      profileContext += `\nKEY SKILLS: ${skills.map(s => s.name).join(', ')}\n`;
    }

    if (certs.length > 0) {
      profileContext += `CERTIFICATIONS: ${certs.map(c => c.name).join(', ')}\n`;
    }

    if (projects.length > 0) {
      profileContext += '\nKEY PROJECTS:\n';
      for (const p of projects) {
        profileContext += `• ${p.name}${p.description ? ': ' + p.description.slice(0, 100) : ''}\n`;
      }
    }

    // Stored positioning or elevator pitch
    const pitch = storedAnswers.find(a => a.questionKey === 'describe_yourself');
    if (posStatement) profileContext += `\nPOSITIONING: ${posStatement}\n`;
    else if (pitch) profileContext += `\nELEVATOR PITCH: ${pitch.answer}\n`;

    // Using Claude Sonnet 4.6 for cover letter generation (or GPT-4o-mini fallback)

    // Build professional header
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cityState = [personalInfo?.city, personalInfo?.state ? (personalInfo.state + ' ' + (personalInfo?.zipCode || '')).trim() : ''].filter(Boolean).join(', ');
    const letterHeader = [
      name,
      personalInfo?.addressLine1 || null,
      cityState || null,
      personalInfo?.phone || null,
      personalInfo?.email || null,
      personalInfo?.linkedinUrl || null,
      personalInfo?.githubUrl || personalInfo?.websiteUrl || null,
      '',
      today,
      '',
      ...(hiringManager ? [hiringManager] : []),
      'Hiring Team',
      company,
      '',
      'Re: ' + jobTitle + ' Position',
      '',
      'Dear ' + (hiringManager || 'Hiring Team') + ',',
    ].filter(l => l !== null).join('\n');

    const prompt = [
      'TASK: Write the body of a professional cover letter. DO NOT write the header/date/greeting - that is already written.',
      '',
      'HARD RULES - FOLLOW EXACTLY:',
      '1. NEVER fabricate, invent, or exaggerate ANY experience, skill, metric, company name, project, or achievement',
      '2. ONLY use facts explicitly stated in the CANDIDATE PROFILE below',
      '3. If the job requires a skill not in the profile, do NOT claim it - focus on transferable skills that ARE present',
      '4. Keep total body under 300 words (3 paragraphs + closing = fits on one page)',
      `5. Writing tone: ${toneWords}. Avoid these words: ${avoidWords}`,
      '',
      'CANDIDATE PROFILE (ONLY use facts from here):',
      profileContext,
      '',
      'JOB DESCRIPTION:',
      (jobDescription || '').slice(0, 1500),
      '',
      'FORMAT - write EXACTLY this structure:',
      'PARAGRAPH 1 (2-3 sentences): Why this specific role at this specific company. Reference something specific from the job description.',
      'PARAGRAPH 2 (3-4 sentences): Your most relevant experience from the profile. Use real job titles, company names, and real accomplishments. Show direct overlap with job requirements.',
      'PARAGRAPH 3 (2 sentences): 2-3 specific skills/technologies that appear in BOTH the job description AND your profile. Be explicit.',
      'CLOSING: One sentence. Then blank line. Then: Sincerely, Then blank line. Then: [full name]',
      '',
      'Begin writing from Paragraph 1 now:',
    ].join('\n');

      max_tokens: 700,
    });

    const body = response.choices[0].message.content || '';
    const coverLetter = letterHeader + '\n\n' + body;

    // Save to DB
    const saved = await prisma.coverLetter.create({
      data: {
        userId: user.id,
        jobId: jobId || undefined,
        jobTitle,
        company,
        content: coverLetter,
        tone,
        isTemplate: false,
      },
    });

    // Log generation
    await prisma.generationRun.create({
      data: {
        userId: user.id,
        type: 'cover_letter',
        model: 'gpt-4o-mini',
        jobId: jobId || undefined,
        jobTitle,
        company,
        groundedFields: ['workHistory', 'skills', 'education', 'writingPrefs'],
        output: coverLetter,
        isApproved: false,
      },
    }).catch(() => {});

    return NextResponse.json({ coverLetter, coverLetterId: saved.id });
  } catch (error) {
    console.error('Cover letter error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}