import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { analyzeJobFit, generateTailoredSummary } from "@/lib/resume-optimizer";

// GET /api/jobs/[id]/analyze - keyword gap analysis for a specific job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const analysis = await analyzeJobFit(user.id, jobId);
    return NextResponse.json(analysis);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}

// POST /api/jobs/[id]/analyze - generate tailored resume summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const variant = await generateTailoredSummary(user.id, jobId);
    return NextResponse.json(variant);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}