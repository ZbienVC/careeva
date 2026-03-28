import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scoreJob } from '@/lib/job-scorer';
import { getCurrentUserFromRequest } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!user.profile) {
      return NextResponse.json({ error: 'User profile not found. Please upload resume first.' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const result = scoreJob(
      {
        skills: user.profile.skills,
        roles: user.profile.roles,
        industries: user.profile.industries,
        yearsExperience: user.profile.yearsExperience || 0,
        education: user.profile.education,
        technologies: user.profile.technologies,
      },
      {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
      }
    );

    const jobScore = await prisma.jobScore.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      update: { score: result.score, reasoning: result.reasoning },
      create: { userId: user.id, jobId, score: result.score, reasoning: result.reasoning },
    });

    return NextResponse.json({ success: true, score: result.score, reasoning: result.reasoning, jobScore }, { status: 200 });
  } catch (error) {
    console.error('Score error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to score job' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (jobId) {
      const score = await prisma.jobScore.findUnique({ where: { userId_jobId: { userId: user.id, jobId } } });
      if (!score) {
        return NextResponse.json({ error: 'Score not found' }, { status: 404 });
      }
      return NextResponse.json({ score }, { status: 200 });
    }

    const scores = await prisma.jobScore.findMany({
      where: { userId: user.id },
      include: { job: true },
      orderBy: { score: 'desc' },
    });

    return NextResponse.json({ scores }, { status: 200 });
  } catch (error) {
    console.error('Score GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}
