/**
 * /api/job-preferences/seed — one-click starter preferences (Q18-C).
 *
 * User-initiated: creates a starter JobPreferences spanning the finance /
 * analytics / crypto / AI / technical-sales families if none exist yet.
 * Everything is editable in the dashboard afterwards. Never overwrites
 * existing preferences. Identity fields are never seeded — those come only
 * from the user's resume/profile (Q18-B is handled by resume upload, which
 * already populates work history, education, and skills from the parsed file).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

const STARTER = {
  targetTitles: [
    'Financial Analyst', 'Data Analyst', 'Business Analyst',
    'AI Engineer', 'Solutions Engineer', 'Sales Engineer',
    'Account Executive', 'Business Development Representative',
    'Product Manager', 'Growth Analyst',
  ],
  targetIndustries: ['Fintech', 'Crypto / Web3', 'AI', 'SaaS', 'Financial Services'],
  roleFamilies: ['analytics', 'fintech', 'crypto', 'ai_ml', 'growth'],
  remotePreference: 'hybrid_ok',
  preferredLocations: ['United States', 'Remote'],
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.jobPreferences.findUnique({ where: { userId: user.id } });
  if (existing && Array.isArray(existing.targetTitles) && existing.targetTitles.length > 0) {
    return NextResponse.json({ seeded: false, message: 'Preferences already configured — nothing changed.', preferences: existing });
  }

  const preferences = await prisma.jobPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...STARTER },
    update: STARTER,
  });
  return NextResponse.json({ seeded: true, message: 'Starter preferences created — edit them in Profile → Job Preferences.', preferences });
}
