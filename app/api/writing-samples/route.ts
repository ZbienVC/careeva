import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
  const session = await getServerSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, type, content } = await req.json();

    if (!title || !type || !content) {
      return NextResponse.json(
        { error: 'Title, type, and content are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const sample = await prisma.writingSample.create({
      data: {
        userId: user.id,
        title,
        type,
        content,
      },
    });

    return NextResponse.json(sample);
  } catch (error) {
    console.error('Failed to create writing sample:', error);
    return NextResponse.json({ error: 'Failed to create writing sample' }, { status: 500 });
  }
}
