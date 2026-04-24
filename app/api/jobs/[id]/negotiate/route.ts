import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generateNegotiationScript } from '@/lib/negotiation';
import type { NegotiationScenario, NegotiationContext } from '@/lib/negotiation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { scenario, currentOffer, targetComp, competingOffer, location, currency } = body as {
    scenario: NegotiationScenario;
    currentOffer: number;
    targetComp: number;
    competingOffer?: number;
    location?: string;
    currency?: string;
  };

  if (!scenario || !currentOffer || !targetComp) {
    return NextResponse.json({ error: 'scenario, currentOffer, targetComp required' }, { status: 400 });
  }

  const { id: jobId } = await params;

  // Fetch job for context
  const { prisma } = await import('@/lib/db');
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  const context: NegotiationContext = {
    currentOffer,
    targetComp,
    role: job?.title || 'this role',
    company: job?.company || 'the company',
    competingOffer,
    location,
    currency,
  };

  try {
    const script = await generateNegotiationScript(scenario, context);
    return NextResponse.json({ script });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
