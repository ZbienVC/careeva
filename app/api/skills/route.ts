import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

// GET /api/skills
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const skills = await prisma.skill.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } });
  return NextResponse.json({ skills });
}

// POST /api/skills — add single or bulk
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();

  // Bulk import: { skills: string[] }
  if (Array.isArray(body.skills)) {
    const existing = await prisma.skill.findMany({ where: { userId: user.id }, select: { name: true } });
    const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
    const toCreate = (body.skills as string[]).filter(s => !existingNames.has(s.toLowerCase()));
    if (toCreate.length > 0) {
      await prisma.skill.createMany({
        data: toCreate.map(name => ({
          userId: user.id,
          name,
          category: 'technical',
        })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json({ added: toCreate.length });
  }

  // Single skill
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const skill = await prisma.skill.create({
    data: {
      userId: user.id,
      name: body.name,
      category: body.category || 'technical',
      proficiency: body.proficiency,
      yearsUsed: body.yearsUsed,
      roleFamilies: body.roleFamilies || [],
    },
  });
  return NextResponse.json({ skill }, { status: 201 });
}

// DELETE /api/skills?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.skill.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ success: true });
}
