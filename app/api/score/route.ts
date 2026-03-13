import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scoreJob } from "@/lib/job-scorer";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.profile) {
      return NextResponse.json(
        { error: "User profile not found. Please upload resume first." },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.userId !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Score the job
    const result = scoreJob(
      {
        skills: user.profile.skills,
        roles: user.profile.roles,
        industries: user.profile.industries,
        yearsExperience: user.profile.yearsExperience || 0,
        education: user.profile.education,
        technologies: user.profile.technologies,
      },
      {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
      }
    );

    // Save score to database
    const jobScore = await prisma.jobScore.upsert({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId,
        },
      },
      update: {
        score: result.score,
        reasoning: result.reasoning,
      },
      create: {
        userId: user.id,
        jobId,
        score: result.score,
        reasoning: result.reasoning,
      },
    });

    return NextResponse.json(
      {
        success: true,
        score: result.score,
        reasoning: result.reasoning,
        jobScore,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Score error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to score job",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get("jobId");

    if (jobId) {
      const score = await prisma.jobScore.findUnique({
        where: {
          userId_jobId: {
            userId: user.id,
            jobId,
          },
        },
      });

      if (!score) {
        return NextResponse.json(
          { error: "Score not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ score }, { status: 200 });
    }

    // Get all scores for user
    const scores = await prisma.jobScore.findMany({
      where: { userId: user.id },
      include: { job: true },
      orderBy: { score: "desc" },
    });

    return NextResponse.json({ scores }, { status: 200 });
  } catch (error) {
    console.error("Score GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scores" },
      { status: 500 }
    );
  }
}
