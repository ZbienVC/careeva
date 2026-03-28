import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobDescription, jobTitle, company, hiringManager, candidateName, tone } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    if (!jobDescription || !jobTitle || !company) {
      return NextResponse.json({ error: 'Job description, job title, and company are required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are an expert cover letter writer. Generate a professional, tailored cover letter based on the following information:

Company: ${company}
Job Title: ${jobTitle}
Hiring Manager: ${hiringManager || 'Hiring Team'}
Candidate Name: ${candidateName || user.name || 'The candidate'}
Tone: ${tone}
Candidate Background Signals: ${[
      user.profile?.jobTitle ? `Target role: ${user.profile.jobTitle}` : '',
      user.profile?.careerGoals ? `Career goals: ${user.profile.careerGoals}` : '',
      user.profile?.skills?.length ? `Skills: ${user.profile.skills.slice(0, 12).join(', ')}` : '',
      user.profile?.roles?.length ? `Prior roles: ${user.profile.roles.slice(0, 6).join(', ')}` : '',
      user.profile?.additionalInfo ? `Additional context: ${user.profile.additionalInfo}` : '',
    ].filter(Boolean).join(' | ') || 'No extra profile context available.'}

Job Description:
${jobDescription}

Write a compelling cover letter that:
- Opens with a strong hook showing enthusiasm for the role
- Highlights relevant experience and skills aligned with the job description
- Shows understanding of the company and why the candidate wants to work there
- Uses the specified tone (${tone})
- Closes with a clear call to action
- Is professional and concise (3-4 paragraphs)

Do not include placeholders or brackets. Write a complete, ready-to-send cover letter.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const coverLetter = completion.choices?.[0]?.message?.content || 'Failed to generate cover letter';
    return NextResponse.json({ coverLetter });
  } catch (error) {
    console.error('Failed to generate cover letter:', error);
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 });
  }
}
