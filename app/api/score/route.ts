import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scoreJob } from '@/lib/job-scorer';
import { getCurrentUserFromRequest } from '@/lib/session';

async function buildProfileForScoring(userId: string) {
  const [profile, personalInfo, workHistory, skills, jobPrefs] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
  ]);

  // Build years of experience from work history
  let yearsExp = 0;
  if (workHistory.length > 0) {
    const earliest = workHistory[workHistory.length - 1]?.startDate;
    if (earliest) yearsExp = Math.floor((Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24 * 365));
  }

  // Merge all skill sources
  const allSkills = [
    ...(profile?.skills || []),
    ...skills.map(s => s.name),
    ...workHistory.flatMap(w => w.skills || []),
  ];
  const allTech = [
    ...(profile?.technologies || []),
    ...workHistory.flatMap(w => w.technologies || []),
  ];

  return {
    skills: [...new Set(allSkills)],
    roles: [...new Set([...(profile?.roles || []), ...(jobPrefs?.targetTitles || [])])],
    industries: [...new Set([...(profile?.industries || []), ...(jobPrefs?.targetIndustries || [])])],
    yearsExperience: yearsExp || profile?.yearsExperience || 0,
    education: profile?.education || [],
    technologies: [...new Set(allTech)],
    // New scoring fields
    targetTitles: jobPrefs?.targetTitles || [],
    targetIndustries: jobPrefs?.targetIndustries || [],
    roleFamilies: jobPrefs?.roleFamilies || [],
    salaryMin: jobPrefs?.salaryMinUSD || undefined,
    salaryMax: jobPrefs?.salaryMaxUSD || undefined,
    remotePreference: jobPrefs?.remotePreference || undefined,
    preferredLocations: jobPrefs?.preferredLocations || [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { jobId, batchJobIds } = body;

    const profileData = await buildProfileForScoring(user.id);

    // Batch scoring
    if (batchJobIds && Array.isArray(batchJobIds)) {
      const jobs = await prisma.job.findMany({ where: { id: { in: batchJobIds }, userId: user.id } });
      const results = [];
      for (const job of jobs) {
        const result = scoreJob(profileData, {
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          salaryMin: job.salaryMin || undefined,
          salaryMax: job.salaryMax || undefined,
          isRemote: job.isRemote || false,
          isHybrid: job.isHybrid || false,
          location: job.location || undefined,
          roleFamilies: job.roleFamilies || [],
          atsType: job.atsType || undefined,
        });
        await prisma.jobScore.upsert({
          where: { userId_jobId: { userId: user.id, jobId: job.id } },
          update: { score: result.score, overallScore: result.overallScore, reasoning: result.reasoning, recommendation: result.recommendation, skillScore: result.skillScore, roleScore: result.roleScore, locationScore: result.locationScore, compensationScore: result.compensationScore },
          create: { userId: user.id, jobId: job.id, score: result.score, overallScore: result.overallScore, reasoning: result.reasoning, recommendation: result.recommendation, skillScore: result.skillScore, roleScore: result.roleScore, locationScore: result.locationScore, compensationScore: result.compensationScore },
        });
        results.push({ jobId: job.id, ...result });
      }
      return NextResponse.json({ success: true, results });
    }

    // Single job
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== user.id) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const result = scoreJob(profileData, {
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      salaryMin: job.salaryMin || undefined,
      salaryMax: job.salaryMax || undefined,
      isRemote: job.isRemote || false,
      isHybrid: job.isHybrid || false,
      location: job.location || undefined,
      roleFamilies: job.roleFamilies || [],
      atsType: job.atsType || undefined,
    });

    const jobScore = await prisma.jobScore.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      update: { score: result.score, overallScore: result.overallScore, reasoning: result.reasoning, recommendation: result.recommendation },
      create: { userId: user.id, jobId, score: result.score, overallScore: result.overallScore, reasoning: result.reasoning, recommendation: result.recommendation },
    });

    return NextResponse.json({ success: true, ...result, jobScore });
  } catch (error) {
    console.error('Score error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to score' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scores = await prisma.jobScore.findMany({
    where: { userId: user.id },
    include: { job: true },
    orderBy: { overallScore: 'desc' },
  });
  return NextResponse.json({ scores });
}