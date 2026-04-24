import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generateJobEvaluation } from '@/lib/job-evaluator';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;

  try {
    const evaluation = await generateJobEvaluation(jobId, user.id);
    return NextResponse.json(evaluation);
  } catch (err: any) {
    console.error('[evaluate] Error:', err);
    return NextResponse.json({ error: err.message || 'Evaluation failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;

  const evaluation = await prisma.jobEvaluation.findUnique({ where: { jobId } });
  if (!evaluation) return NextResponse.json({ error: 'No evaluation yet' }, { status: 404 });

  return NextResponse.json(evaluation);
}
