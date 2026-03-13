import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: OnboardingData = await request.json();

    // Validate required fields
    if (!body.jobTitle || !body.targetIndustries || !body.jobType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    return NextResponse.json(
      {
        success: true,
        profile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Onboarding failed",
      },
      { status: 500 }
    );
  }
}
