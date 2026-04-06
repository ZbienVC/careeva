import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobDescription, jobTitle, company, hiringManager, tone = 'professional', jobId } = await req.json();

    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are writing a cover letter for ${name} applying to ${company} for the ${jobTitle} position.

WRITING STYLE: ${toneWords}. DO NOT use: ${avoidWords}. Be specific, human, and authentic.

${profileContext}

JOB DESCRIPTION (first 1200 chars):
${(jobDescription || '').slice(0, 1200)}

INSTRUCTIONS:
- Write 3 paragraphs: (1) why this specific role/company, (2) most relevant experience with 1-2 concrete examples from the profile above, (3) what you bring and call to action
- Address it to "${hiringManager || 'Hiring Team'}"
- Do NOT fabricate any experience, metrics, or skills not mentioned in the profile
- Keep it under 350 words
- Format as ready-to-send (include greeting and sign-off)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 700,
    });

    const coverLetter = response.choices[0].message.content || '';

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