/**
 * /api/apply-queue
 * GET  — list tasks (filter by status), powering the Review Queue page
 * POST — enqueue a job for the worker { jobId, mode? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { enqueueApplyTask, getWorkerStatus } from '@/lib/apply-queue';

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = request.nextUrl.searchParams.get('status');
  const tasks = await prisma.applyTask.findMany({
    where: { userId: user.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const jobIds = [...new Set(tasks.map((t: { jobId: string }) => t.jobId))];
  const [jobs, worker] = await Promise.all([
    prisma.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, title: true, company: true, url: true, applyUrl: true } }),
    getWorkerStatus(),
  ]);
  const jobMap = Object.fromEntries(jobs.map((j: { id: string }) => [j.id, j]));
  return NextResponse.json({
    tasks: tasks.map((t: { jobId: string } & Record<string, unknown>) => ({ ...t, job: jobMap[t.jobId] || null })),
    worker,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  try {
    const result = await enqueueApplyTask(user.id, body.jobId, body.mode);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Enqueue failed' }, { status: 500 });
  }
}
