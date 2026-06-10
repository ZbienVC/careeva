/**
 * /api/apply-queue/[id]
 * GET    — task detail (packet, field report, screenshot key)
 * PATCH  — { action: "approve" | "cancel" | "retry" }
 *           approve: awaiting_approval -> approved (worker submits)
 *           cancel : any non-final -> cancelled
 *           retry  : failed/needs_review -> queued (resets attempts)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const task = await prisma.applyTask.findFirst({ where: { id, userId: user.id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const job = await prisma.job.findUnique({ where: { id: task.jobId }, select: { title: true, company: true, url: true, applyUrl: true } });
  return NextResponse.json({ ...task, job });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action } = await request.json().catch(() => ({}));
  const task = await prisma.applyTask.findFirst({ where: { id, userId: user.id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'approve') {
    if (task.status !== 'awaiting_approval') {
      return NextResponse.json({ error: `Cannot approve task in status "${task.status}"` }, { status: 409 });
    }
    const updated = await prisma.applyTask.update({
      where: { id }, data: { status: 'approved', approvedAt: new Date(), claimedBy: null },
    });
    return NextResponse.json(updated);
  }
  if (action === 'cancel') {
    if (['submitted', 'cancelled'].includes(task.status)) {
      return NextResponse.json({ error: 'Task already final' }, { status: 409 });
    }
    const updated = await prisma.applyTask.update({ where: { id }, data: { status: 'cancelled' } });
    return NextResponse.json(updated);
  }
  if (action === 'retry') {
    if (!['failed', 'needs_review', 'cancelled'].includes(task.status)) {
      return NextResponse.json({ error: `Cannot retry task in status "${task.status}"` }, { status: 409 });
    }
    const updated = await prisma.applyTask.update({
      where: { id }, data: { status: 'queued', attempts: 0, claimedBy: null, lastError: null },
    });
    return NextResponse.json(updated);
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
