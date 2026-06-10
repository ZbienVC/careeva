/**
 * /api/apply-queue/[id]
 * GET    — task detail (packet, field report, screenshot key)
 * PATCH  — { action: "approve" | "cancel" | "retry" | "update_answers" }
 *           approve        : awaiting_approval -> approved (worker submits)
 *           cancel         : any non-final -> cancelled
 *           retry          : failed/needs_review -> queued (resets attempts)
 *           update_answers : merge user-edited answers into the packet and
 *                            requeue so the worker refills with the edits
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
  const body = await request.json().catch(() => ({}));
  const { action } = body;
  const task = await prisma.applyTask.findFirst({ where: { id, userId: user.id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'update_answers') {
    // Edit the application's answers without leaving Careeva: merge the edits
    // into the packet and requeue so the worker refills the form with them.
    const edits = body.answers;
    if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
      return NextResponse.json({ error: 'answers object required' }, { status: 400 });
    }
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(edits)) {
      if (typeof value === 'string') sanitized[key] = value.slice(0, 4000);
    }
    const packet = (task.packet || {}) as Record<string, unknown>;
    const mergedPacket = {
      ...packet,
      answers: { ...((packet.answers as Record<string, string>) || {}), ...sanitized },
    };
    const result = await prisma.applyTask.updateMany({
      where: { id, userId: user.id, status: { in: ['awaiting_approval', 'needs_review', 'failed', 'queued'] } },
      data: { packet: mergedPacket, status: 'queued', attempts: 0, claimedBy: null, lastError: null, approvedAt: null },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: `Cannot edit answers while task is "${task.status}"` }, { status: 409 });
    }
    return NextResponse.json(await prisma.applyTask.findUnique({ where: { id } }));
  }

  // All transitions are CONDITIONAL updates (status checked inside the UPDATE)
  // so a concurrently-running worker can't race the user's action.
  if (action === 'approve') {
    const result = await prisma.applyTask.updateMany({
      where: { id, userId: user.id, status: 'awaiting_approval' },
      data: { status: 'approved', approvedAt: new Date(), claimedBy: null },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: `Cannot approve task in status "${task.status}"` }, { status: 409 });
    }
    return NextResponse.json(await prisma.applyTask.findUnique({ where: { id } }));
  }
  if (action === 'cancel') {
    const result = await prisma.applyTask.updateMany({
      where: { id, userId: user.id, status: { notIn: ['submitted', 'cancelled'] } },
      data: { status: 'cancelled' },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Task already final' }, { status: 409 });
    }
    // Keep the tracker honest: a cancelled task means this application is withdrawn.
    if (task.applicationId) {
      await prisma.application.updateMany({
        where: { id: task.applicationId, userId: user.id, status: 'prepping' },
        data: { status: 'withdrawn' },
      }).catch(() => {});
    }
    return NextResponse.json(await prisma.applyTask.findUnique({ where: { id } }));
  }
  if (action === 'retry') {
    const result = await prisma.applyTask.updateMany({
      where: { id, userId: user.id, status: { in: ['failed', 'needs_review', 'cancelled'] } },
      data: { status: 'queued', attempts: 0, claimedBy: null, lastError: null },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: `Cannot retry task in status "${task.status}"` }, { status: 409 });
    }
    // Re-activate the tracker row if the cancel path had withdrawn it.
    if (task.applicationId) {
      await prisma.application.updateMany({
        where: { id: task.applicationId, userId: user.id, status: 'withdrawn' },
        data: { status: 'prepping' },
      }).catch(() => {});
    }
    return NextResponse.json(await prisma.applyTask.findUnique({ where: { id } }));
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
