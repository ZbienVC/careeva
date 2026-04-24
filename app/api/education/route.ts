import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

// GET /api/education
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entries = await prisma.educationEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ isCurrent: 'desc' }, { endDate: 'desc' }],
  });
  return NextResponse.json({ entries });
}

// POST /api/education
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.institution) return NextResponse.json({ error: 'institution required' }, { status: 400 });
  const entry = await prisma.educationEntry.create({
    data: {
      userId: user.id,
      institution: body.institution,
      degree: body.degree,
      fieldOfStudy: body.fieldOfStudy,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      isCurrent: body.isCurrent || false,
      gpa: body.gpa,
      honors: body.honors,
      notes: body.notes,
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}

// DELETE /api/education?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const existing = await prisma.educationEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.educationEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
