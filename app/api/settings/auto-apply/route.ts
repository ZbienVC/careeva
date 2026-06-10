/**
 * /api/settings/auto-apply — read/update the user's automation settings (Q3/6/8/12/14/16).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

const DEFAULTS = {
  autoApplyEnabled: false,
  submitMode: 'approve_first',
  unknownQuestionMode: 'pause',
  attachCoverLetter: true,
  resumeVariant: 'uploaded',
  minScoreToApply: 50,
  maxAppliesPerRun: 0,
  minDelaySeconds: 30,
  maxDelaySeconds: 90,
  allowSameCompanyRoles: false,
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const config = await prisma.autoApplyConfig.findUnique({ where: { userId: user.id } });
  return NextResponse.json(config || { ...DEFAULTS, userId: user.id, _unsaved: true });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  const allowed = [
    'autoApplyEnabled', 'submitMode', 'unknownQuestionMode', 'attachCoverLetter',
    'resumeVariant', 'minScoreToApply', 'minScoreToAutoApply', 'maxAppliesPerRun',
    'minDelaySeconds', 'maxDelaySeconds', 'allowSameCompanyRoles',
    'companyBlacklist', 'titleBlacklist', 'titleWhitelist', 'maxApplicationsPerDay',
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) data[key] = body[key];

  if (typeof data.submitMode === 'string' && !['approve_first', 'fill_and_leave', 'full_auto'].includes(data.submitMode)) {
    return NextResponse.json({ error: 'Invalid submitMode' }, { status: 400 });
  }
  if (typeof data.minDelaySeconds === 'number' && data.minDelaySeconds < 5) data.minDelaySeconds = 5;

  const config = await prisma.autoApplyConfig.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...DEFAULTS, ...data },
    update: data,
  });
  return NextResponse.json(config);
}
