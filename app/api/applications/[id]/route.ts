import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

// GET /api/applications/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const app = await prisma.application.findFirst({ where: { id, userId: user.id } });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch associated cover letter if any
  let coverLetter = '';
  if (app.jobId) {
    const cl = await prisma.coverLetter.findFirst({
      where: { userId: user.id, jobId: app.jobId },
      orderBy: { createdAt: 'desc' },
    });
    coverLetter = cl?.content || '';
  }

  return NextResponse.json({
    id: app.id,
    company: app.company,
    role: app.role,
    status: app.status,
    dateApplied: app.dateApplied || app.appliedAt?.toISOString().split('T')[0] || '',
    notes: app.notes || '',
    url: app.url || '',
    coverLetter,
    jobId: app.jobId,
  });
}

// PUT /api/applications/[id] - update status, notes, etc.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const app = await prisma.application.findFirst({ where: { id, userId: user.id } });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { company, role, status, dateApplied, notes, url } = body;

  const updated = await prisma.application.update({
    where: { id },
    data: {
      ...(company !== undefined && { company }),
      ...(role !== undefined && { role }),
      ...(status !== undefined && { status }),
      ...(dateApplied !== undefined && { dateApplied, appliedAt: new Date(dateApplied) }),
      ...(notes !== undefined && { notes }),
      ...(url !== undefined && { url }),
    },
  });

  // Fetch cover letter for response
  let coverLetter = '';
  if (updated.jobId) {
    const cl = await prisma.coverLetter.findFirst({
      where: { userId: user.id, jobId: updated.jobId },
      orderBy: { createdAt: 'desc' },
    });
    coverLetter = cl?.content || '';
  }

  return NextResponse.json({
    id: updated.id,
    company: updated.company,
    role: updated.role,
    status: updated.status,
    dateApplied: updated.dateApplied || updated.appliedAt?.toISOString().split('T')[0] || '',
    notes: updated.notes || '',
    url: updated.url || '',
    coverLetter,
    jobId: updated.jobId,
  });
}

// DELETE /api/applications/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const app = await prisma.application.findFirst({ where: { id, userId: user.id } });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.application.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
