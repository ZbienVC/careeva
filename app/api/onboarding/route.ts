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
  careerGoals: string;
  additionalInfo: string;
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

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        jobTitle: body.jobTitle,
        targetIndustries: body.targetIndustries,
        desiredSalaryMin: body.desiredSalaryMin,
        desiredSalaryMax: body.desiredSalaryMax,
        jobType: body.jobType,
        willingToRelocate: body.willingToRelocate,
        careerGoals: body.careerGoals,
        additionalInfo: body.additionalInfo,
      },
      create: {
        userId: user.id,
        jobTitle: body.jobTitle,
        targetIndustries: body.targetIndustries,
        desiredSalaryMin: body.desiredSalaryMin,
        desiredSalaryMax: body.desiredSalaryMax,
        jobType: body.jobType,
        willingToRelocate: body.willingToRelocate,
        careerGoals: body.careerGoals,
        additionalInfo: body.additionalInfo,
      },
    });

    return NextResponse.json({ success: true, profile }, { status: 200 });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Onboarding failed' }, { status: 500 });
  }
}
