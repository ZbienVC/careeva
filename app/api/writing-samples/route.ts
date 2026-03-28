import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const samples = await prisma.writingSample.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(samples);
  } catch (error) {
    console.error('Failed to fetch writing samples:', error);
    return NextResponse.json({ error: 'Failed to fetch writing samples' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, type, content } = await req.json();

    if (!title || !type || !content) {
      return NextResponse.json({ error: 'Title, type, and content are required' }, { status: 400 });
    }

    const sample = await prisma.writingSample.create({
      data: { userId: user.id, title, type, content },
    });

    return NextResponse.json(sample);
  } catch (error) {
    console.error('Failed to create writing sample:', error);
    return NextResponse.json({ error: 'Failed to create writing sample' }, { status: 500 });
  }
}
