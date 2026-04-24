/**
 * app/api/applications/followups/route.ts
 *
 * Follow-up cadence tracker (career-ops followup mode)
 *
 * GET  - Returns all applications with follow-up status, urgency, days since apply
 * POST - Log a follow-up action (email sent, LinkedIn message, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generate } from '@/lib/ai-client';

// Cadence rules (days after each stage before following up)
const CADENCE: Record<string, number> = {
  applied: 7,      // Follow up 7 days after applying
  prepping: 5,
  phone_screen: 3, // Follow up 3 days after phone screen
  interview: 1,    // Follow up within 24h after interview
  offer: 2,        // Follow up 2 days if offer is pending decision
};

type Urgency = 'urgent' | 'overdue' | 'waiting' | 'cold' | 'done';

function getUrgency(daysSince: number, followupCount: number, status: string): Urgency {
  if (['rejected', 'offer', 'withdrawn', 'archived'].includes(status)) return 'done';
  const threshold = CADENCE[status] || 7;
  if (daysSince > threshold * 2 && followupCount >= 2) return 'cold';
  if (daysSince > threshold && followupCount === 0) return 'urgent';
  if (daysSince > threshold) return 'overdue';
  return 'waiting';
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const applications = await prisma.application.findMany({
    where: {
      userId: user.id,
      status: { notIn: ['rejected', 'offer_accepted', 'withdrawn', 'archived'] },
    },
    include: {
      events: {
        where: { eventType: { in: ['followup_sent', 'status_change'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { appliedAt: 'asc' },
  });

  const now = Date.now();
  const entries = applications.map(app => {
    const appliedAt = app.appliedAt?.getTime() || app.createdAt.getTime();
    const daysSince = Math.floor((now - appliedAt) / (1000 * 60 * 60 * 24));
    const followups = app.events.filter(e => e.eventType === 'followup_sent');
    const lastFollowup = followups[0]?.createdAt;
    const daysSinceFollowup = lastFollowup
      ? Math.floor((now - lastFollowup.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const urgency = getUrgency(daysSince, followups.length, app.status);
    const nextFollowupDays = CADENCE[app.status] || 7;

    return {
      id: app.id,
      company: app.company,
      role: app.role,
      status: app.status,
      url: app.url,
      appliedAt: app.appliedAt || app.createdAt,
      daysSince,
      followupCount: followups.length,
      lastFollowup,
      daysSinceFollowup,
      urgency,
      nextFollowupDue: urgency === 'waiting'
        ? new Date(appliedAt + nextFollowupDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
      notes: app.notes,
    };
  });

  // Sort: urgent > overdue > waiting > cold > done
  const urgencyOrder = { urgent: 0, overdue: 1, waiting: 2, cold: 3, done: 4 };
  entries.sort((a, b) => (urgencyOrder[a.urgency] || 4) - (urgencyOrder[b.urgency] || 4));

  const stats = {
    urgent: entries.filter(e => e.urgency === 'urgent').length,
    overdue: entries.filter(e => e.urgency === 'overdue').length,
    waiting: entries.filter(e => e.urgency === 'waiting').length,
    cold: entries.filter(e => e.urgency === 'cold').length,
    total: entries.length,
  };

  return NextResponse.json({ entries, stats });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { applicationId, action, note, generateDraft } = body;
  // action: 'email_sent' | 'linkedin_sent' | 'called' | 'no_response'

  if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id },
  });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Log the follow-up event
  await prisma.applicationEvent.create({
    data: {
      applicationId,
      eventType: 'followup_sent',
      toStatus: app.status,
      note: note || action || 'Follow-up sent',
      metadata: { action, note },
    },
  });

  let draft = null;

  // Generate follow-up email draft if requested
  if (generateDraft) {
    const [personalInfo, workHistory, skills] = await Promise.all([
      prisma.personalInfo.findUnique({ where: { userId: user.id } }),
      prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' }, take: 2 }),
      prisma.skill.findMany({ where: { userId: user.id }, take: 10 }),
    ]);

    const daysSince = Math.floor((Date.now() - (app.appliedAt?.getTime() || app.createdAt.getTime())) / (1000 * 60 * 60 * 24));
    const candidateName = personalInfo?.fullName || 'the candidate';
    const topSkills = skills.slice(0, 5).map(s => s.name).join(', ');
    const currentRole = workHistory[0] ? workHistory[0].title + ' at ' + workHistory[0].company : 'professional';

    draft = await generate({
      task: 'answer_short',
      maxTokens: 350,
      systemPrompt: `You write professional follow-up emails for job applications. Rules:
- Never use "just checking in", "touching base", or "circling back"
- Lead with value, not with the ask
- Reference something specific about the role/company
- Keep under 120 words
- Include a subject line
- Professional but warm tone`,
      prompt: `Write a follow-up email for this situation:

Candidate: ${candidateName} (${currentRole})
Key skills: ${topSkills}
Applied for: ${app.role} at ${app.company}
Days since applying: ${daysSince}
Current status: ${app.status}
Notes: ${app.notes || 'none'}

Generate a subject line and email body. Lead with one specific value-add relevant to ${app.company}.`,
    });
  }

  return NextResponse.json({ success: true, draft });
}
