import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

interface OnboardingData {
  jobTitle: string;
  targetIndustries: string[];
  desiredSalaryMin: number;
  desiredSalaryMax: number;
  jobType: string[];
  willingToRelocate: boolean;
  relocationScope?: 'none' | 'regional' | 'national' | 'international';
  city?: string;
  state?: string;
  country?: string;
  careerGoals: string;
  additionalInfo: string;
}

// Map the onboarding work-style answers onto the search engine's remote preference.
function deriveRemotePreference(jobType: string[] | undefined): string {
  const types = (jobType || []).map((t) => t.toLowerCase());
  const wantsRemote = types.includes('remote');
  const wantsHybrid = types.includes('hybrid');
  const wantsOnsite = types.includes('on-site');

  if (wantsRemote && !wantsHybrid && !wantsOnsite) return 'remote_only';
  if (wantsOnsite && !wantsRemote && !wantsHybrid) return 'onsite_ok';
  if (wantsRemote || wantsHybrid) return 'hybrid_ok';
  return 'any';
}

// GET — return the user's saved onboarding answers so the wizard pre-fills
// instead of greeting returning users with a blank form.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profile, prefs, personalInfo] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
    prisma.personalInfo.findUnique({ where: { userId: user.id } }),
  ]);

  const relocationScope =
    prefs?.relocationNote && ['none', 'regional', 'national', 'international'].includes(prefs.relocationNote)
      ? prefs.relocationNote
      : (prefs?.willingToRelocate ?? profile?.willingToRelocate) ? 'national' : '';

  return NextResponse.json({
    jobTitle: profile?.jobTitle || '',
    targetIndustries: profile?.targetIndustries || [],
    city: personalInfo?.city || '',
    state: personalInfo?.state || '',
    relocationScope,
    desiredSalaryMin: profile?.desiredSalaryMin ?? null,
    desiredSalaryMax: profile?.desiredSalaryMax ?? null,
    jobType: profile?.jobType || [],
    careerGoals: profile?.careerGoals || '',
    additionalInfo: profile?.additionalInfo || '',
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: OnboardingData = await request.json();

    if (!body.jobTitle || !body.targetIndustries || !body.jobType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const relocationScope = body.relocationScope || (body.willingToRelocate ? 'national' : 'none');
    const willingToRelocate = relocationScope !== 'none';

    const homeBase = [body.city, body.state].filter(Boolean).join(', ');
    const preferredLocations = homeBase ? [homeBase] : [];

    const profileFields = {
      jobTitle: body.jobTitle,
      targetIndustries: body.targetIndustries,
      desiredSalaryMin: body.desiredSalaryMin,
      desiredSalaryMax: body.desiredSalaryMax,
      jobType: body.jobType,
      willingToRelocate,
      careerGoals: body.careerGoals,
      additionalInfo: body.additionalInfo,
    };

    // Users naturally enter several roles in one box ("Analyst, Strategy,
    // Sales Engineer") — each becomes its OWN search target, not one giant
    // query string.
    const targetTitles = body.jobTitle
      .split(/,|\/|;| and /i)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    // Job search, scoring, and automation all read JobPreferences — onboarding
    // must populate it or the answers never reach the engine.
    const preferenceFields = {
      targetTitles: targetTitles.length ? targetTitles : [body.jobTitle],
      targetIndustries: body.targetIndustries,
      salaryMinUSD: body.desiredSalaryMin ? Math.round(body.desiredSalaryMin) : null,
      salaryMaxUSD: body.desiredSalaryMax ? Math.round(body.desiredSalaryMax) : null,
      // Don't clear previously saved locations when home base is left blank
      ...(preferredLocations.length ? { preferredLocations } : {}),
      remotePreference: deriveRemotePreference(body.jobType),
      willingToRelocate,
      relocationNote: relocationScope,
    };

    // Only write home-base fields the user actually provided — re-running
    // onboarding with blanks must not wipe data managed on the profile page.
    const personalFields = {
      ...(body.city ? { city: body.city } : {}),
      ...(body.state ? { state: body.state } : {}),
      ...(body.country ? { country: body.country } : {}),
    };

    const [profile] = await prisma.$transaction([
      prisma.userProfile.upsert({
        where: { userId: user.id },
        update: profileFields,
        create: { userId: user.id, ...profileFields },
      }),
      prisma.jobPreferences.upsert({
        where: { userId: user.id },
        update: preferenceFields,
        create: { userId: user.id, ...preferenceFields },
      }),
      prisma.personalInfo.upsert({
        where: { userId: user.id },
        update: personalFields,
        create: { userId: user.id, country: 'US', ...personalFields },
      }),
    ]);

    return NextResponse.json({ success: true, profile }, { status: 200 });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Onboarding failed' }, { status: 500 });
  }
}
