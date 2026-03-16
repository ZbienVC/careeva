import { getServerSession } from 'next-auth/next';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobDescription, jobTitle, company, hiringManager, candidateName, tone } = await req.json();

    if (!jobDescription || !jobTitle || !company) {
      return NextResponse.json(
        { error: 'Job description, job title, and company are required' },
        { status: 400 }
      );
    }

    const prompt = `You are an expert cover letter writer. Generate a professional, tailored cover letter based on the following information:

Company: ${company}
Job Title: ${jobTitle}
Hiring Manager: ${hiringManager || 'Hiring Team'}
Candidate Name: ${candidateName}
Tone: ${tone}

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

    const message = await openai.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const coverLetter =
      message.content[0].type === 'text'
        ? message.content[0].text
        : 'Failed to generate cover letter';

    return NextResponse.json({ coverLetter });
  } catch (error) {
    console.error('Failed to generate cover letter:', error);
    return NextResponse.json({ error: 'Failed to generate cover letter' }, { status: 500 });
  }
}
