import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { prisma } from '@/lib/db';

// GET /api/answers - list all stored reusable answers
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const answers = await prisma.reusableAnswer.findMany({
    where: { userId: user.id },
    orderBy: [{ questionFamily: 'asc' }, { questionKey: 'asc' }],
  });

  return NextResponse.json({ answers });
}

// POST /api/answers - create or update a reusable answer
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { questionKey, questionFamily, questionText, answer, answerShort, answerLong } = body;

  if (!questionKey || !answer) {
    return NextResponse.json({ error: 'questionKey and answer are required' }, { status: 400 });
  }

  const record = await prisma.reusableAnswer.upsert({
    where: { userId_questionKey: { userId: user.id, questionKey } },
    create: {
      userId: user.id,
      questionKey,
      questionFamily: questionFamily || 'misc',
      questionText,
      answer,
      answerShort,
      answerLong,
      isVerified: true,
    },
    update: {
      answer,
      answerShort,
      answerLong,
      questionText: questionText || undefined,
      isVerified: true,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, answer: record });
}