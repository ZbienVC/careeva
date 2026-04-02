import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';

// GET /api/profile/full â€” returns the complete structured profile
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [
    personalInfo,
    workHistory,
    education,
    projects,
    certifications,
    socialLinks,
    skills,
    jobPrefs,
    writingPrefs,
    autoApplyConfig,
    resumes,
  ] = await Promise.all([
    prisma.personalInfo.findUnique({ where: { userId: user.id } }),
    prisma.workHistory.findMany({
      where: { userId: user.id },
      include: { bullets: true },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    }),
    prisma.educationEntry.findMany({
      where: { userId: user.id },
      orderBy: [{ isCurrent: 'desc' }, { endDate: 'desc' }],
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      include: { bullets: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.certification.findMany({
      where: { userId: user.id },
      orderBy: { issueDate: 'desc' },
    }),
    prisma.socialLink.findMany({ where: { userId: user.id } }),
    prisma.skill.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
    prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
    prisma.writingPreferences.findUnique({ where: { userId: user.id } }),
    prisma.autoApplyConfig.findUnique({ where: { userId: user.id } }),
    prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: [{ isBase: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  // Completeness score
  const checks = [
    !!personalInfo?.fullName,
    !!personalInfo?.email,
    !!personalInfo?.phone,
    !!personalInfo?.linkedinUrl,
    workHistory.length > 0,
    education.length > 0,
    skills.length >= 5,
    !!jobPrefs?.targetTitles?.length,
    !!jobPrefs?.salaryMinUSD,
    !!jobPrefs?.remotePreference,
    resumes.length > 0,
    !!writingPrefs?.positioningStatement,
  ];
  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return NextResponse.json({
    completeness,
    personalInfo,
    workHistory,
    education,
    projects,
    certifications,
    socialLinks,
    skills,
    jobPreferences: jobPrefs,
    writingPreferences: writingPrefs,
    autoApplyConfig,
    resumes,
  });
}
