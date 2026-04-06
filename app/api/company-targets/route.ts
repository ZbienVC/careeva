import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

/**
 * /api/company-targets
 * 
 * Lets the user save a list of specific companies they want to target.
 * The system will:
 * 1. Auto-detect the ATS from the career page URL
 * 2. Sync jobs from their Greenhouse/Lever board automatically
 * 3. For other ATS types, queue for manual application tracking
 * 4. Score all found jobs against user profile
 */

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get saved company targets from AutoApplyConfig or a reusable answer key
  const config = await prisma.autoApplyConfig.findUnique({ where: { userId: user.id } });
  const targets = (config as any)?.companyPriority || [];

  // Also fetch any jobs we've synced from these companies
  const syncedCompanies = await prisma.company.findMany({
    where: { OR: targets.map((name: string) => ({ name: { contains: name, mode: 'insensitive' as const } })) },
    take: 50,
  });

  return NextResponse.json({ targets, syncedCompanies });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companies } = body; // Array of { name, careerPageUrl, notes }

  if (!Array.isArray(companies)) return NextResponse.json({ error: 'companies array required' }, { status: 400 });

  // Save to auto-apply config company priority list
  await prisma.autoApplyConfig.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      companyPriority: companies.map((c: any) => c.name || c),
    },
    update: {
      companyPriority: companies.map((c: any) => c.name || c),
    },
  });

  // Trigger immediate sync for companies with known ATS URLs
  const synced: string[] = [];
  const queued: string[] = [];

  for (const co of companies) {
    const url = co.careerPageUrl || '';
    if (!url) { queued.push(co.name); continue; }

    // Auto-detect Greenhouse
    if (url.includes('greenhouse.io') || url.includes('boards.greenhouse')) {
      const match = url.match(/boards(?:\.greenhouse\.io)?\/([^/?\s]+)/);
      if (match) {
        try {
          const { syncGreenhouseBoard } = await import('@/lib/job-connectors');
          const scrapeRun = await prisma.scrapeRun.create({
            data: { userId: user.id, source: 'greenhouse', status: 'running', startedAt: new Date() },
          });
          await syncGreenhouseBoard(user.id, match[1], scrapeRun.id);
          await prisma.scrapeRun.update({ where: { id: scrapeRun.id }, data: { status: 'complete', completedAt: new Date() } });
          synced.push(co.name || match[1]);
          continue;
        } catch { /* fall through */ }
      }
    }

    // Auto-detect Lever
    if (url.includes('lever.co')) {
      const match = url.match(/lever\.co\/([^/?#\s]+)/);
      if (match) {
        try {
          const { syncLeverBoard } = await import('@/lib/job-connectors');
          const scrapeRun = await prisma.scrapeRun.create({
            data: { userId: user.id, source: 'lever', status: 'running', startedAt: new Date() },
          });
          await syncLeverBoard(user.id, match[1], scrapeRun.id);
          await prisma.scrapeRun.update({ where: { id: scrapeRun.id }, data: { status: 'complete', completedAt: new Date() } });
          synced.push(co.name || match[1]);
          continue;
        } catch { /* fall through */ }
      }
    }

    // Save as a company for future tracking
    await prisma.company.upsert({
      where: { name: co.name || url },
      create: {
        name: co.name || url,
        careerPageUrl: url,
        atsType: url.includes('workday') ? 'workday' :
                 url.includes('ashby') ? 'ashby' :
                 url.includes('icims') ? 'icims' :
                 url.includes('taleo') ? 'taleo' :
                 url.includes('smartrecruiters') ? 'smartrecruiters' : undefined,
      },
      update: { careerPageUrl: url },
    }).catch(() => {});
    queued.push(co.name);
  }

  return NextResponse.json({
    success: true,
    synced,
    queued,
    message: `${synced.length} companies synced immediately, ${queued.length} saved for tracking`,
  });
}
