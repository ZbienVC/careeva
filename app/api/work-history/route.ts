import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { prisma } from '@/lib/db';

// GET /api/work-history â€” list all work history
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workHistory = await prisma.workHistory.findMany({
    where: { userId: user.id },
    include: { bullets: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
  });

  return NextResponse.json({ workHistory });
}

// POST /api/work-history â€” create a new work history entry
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { company, title, startDate, endDate, isCurrent, location, isRemote, summary, roleFamilies, skills, technologies, bullets } = body;

  if (!company || !title || !startDate) {
    return NextResponse.json({ error: 'company, title, and startDate are required' }, { status: 400 });
  }

  const entry = await prisma.workHistory.create({
    data: {
      userId: user.id,
      company,
      title,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      isCurrent: isCurrent || false,
      location,
      isRemote: isRemote || false,
      summary,
      roleFamilies: roleFamilies || [],
      skills: skills || [],
      technologies: technologies || [],
      bullets: bullets?.length
        ? {
            create: bullets.map((b: { content: string; isHighlight?: boolean; roleFamilies?: string[]; skills?: string[] }, i: number) => ({
              content: b.content,
              isHighlight: b.isHighlight || false,
              roleFamilies: b.roleFamilies || [],
              skills: b.skills || [],
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { bullets: true },
  });

  return NextResponse.json({ success: true, entry }, { status: 201 });
}

// PUT /api/work-history â€” update an entry
export async function PUT(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.workHistory.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entry = await prisma.workHistory.update({
    where: { id },
    data: {
      ...updates,
      startDate: updates.startDate ? new Date(updates.startDate) : undefined,
      endDate: updates.endDate ? new Date(updates.endDate) : undefined,
      updatedAt: new Date(),
    },
    include: { bullets: true },
  });

  return NextResponse.json({ success: true, entry });
}

// DELETE /api/work-history?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.workHistory.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.workHistory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
