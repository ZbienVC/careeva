import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    const jobs = await prisma.job.findMany({
      where: { userId: user.id },
      include: {
        jobScores: {
          where: { userId: user.id },
          select: { score: true, reasoning: true },
        },
        applications: {
          where: { userId: user.id },
          select: { status: true, appliedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    });

    const total = await prisma.job.count({
      where: { userId: user.id },
    });

    return NextResponse.json(
      {
        jobs,
        pagination: { total, limit, skip },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Jobs GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.company || !body.description) {
      return NextResponse.json(
        { error: "Missing required fields (title, company, description)" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await prisma.job.create({
      data: {
        userId: user.id,
        title: body.title,
        company: body.company,
        description: body.description,
        requirements: body.requirements || "",
        salary: body.salary,
        location: body.location,
        jobType: body.jobType,
        url: body.url,
        source: body.source || "manual",
      },
    });

    return NextResponse.json(
      {
        success: true,
        job,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Jobs POST error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create job",
      },
      { status: 500 }
    );
  }
}
