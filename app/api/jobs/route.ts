import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const search = (searchParams.get('search') || '').trim();

    // Search the FULL job set server-side, before pagination — filtering after
    // pagination silently searched only one page of results.
    const where: any = { userId: user.id };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        jobScores: {
          where: { userId: user.id },
          select: { id: true, userId: true, jobId: true, score: true, reasoning: true, createdAt: true, updatedAt: true },
        },
        applications: {
          where: { userId: user.id },
          select: { status: true, appliedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    const total = await prisma.job.count({ where });

    return NextResponse.json({ jobs, pagination: { total, limit, skip } }, { status: 200 });
  } catch (error) {
    console.error('Jobs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.title || !body.company || !body.description) {
      return NextResponse.json({ error: 'Missing required fields (title, company, description)' }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        userId: user.id,
        title: body.title,
        company: body.company,
        description: body.description,
        requirements: body.requirements || '',
        salary: body.salary,
        location: body.location,
        jobType: body.jobType,
        url: body.url,
        source: body.source || 'manual',
      },
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create job' }, { status: 500 });
  }
}

// DELETE /api/jobs - clear all scraped jobs (not manually added ones) to allow fresh search
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { prisma } = await import('@/lib/prisma');
    // Only delete scraped jobs, not manually added ones, and not jobs with applications
    const result = await prisma.job.deleteMany({
      where: {
        userId: user.id,
        source: { not: 'manual' },
        applications: { none: {} },
      },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}