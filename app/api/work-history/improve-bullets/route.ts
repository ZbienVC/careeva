import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { improveResumeBullets, isAIConfigured } from "@/lib/ai-client";

// POST /api/work-history/improve-bullets
// Takes existing bullets and a job ID, returns improved versions
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAIConfigured()) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const { workHistoryId, jobId } = await request.json();

  const [wh, job] = await Promise.all([
    prisma.workHistory.findFirst({ where: { id: workHistoryId, userId: user.id }, include: { bullets: { orderBy: { sortOrder: "asc" } } } }),
    jobId ? prisma.job.findUnique({ where: { id: jobId } }) : null,
  ]);

  if (!wh) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existingBullets = wh.bullets.map(b => b.content).join("\n");
  const jobContext = job ? `TARGET ROLE: ${job.title} at ${job.company}\nJOB REQUIREMENTS: ${job.description?.slice(0, 800) || ""}` : "";

  const prompt = `Improve these resume bullet points for ${wh.title} at ${wh.company}.

RULES:
- Keep every fact, metric, and outcome that exists
- Do NOT add any metrics, achievements, or skills not already present  
- Strengthen verbs and clarity
- Make impact more explicit where the data supports it
- Return ONLY the improved bullets, one per line, starting with a bullet point (•)

${jobContext ? jobContext + "\n\n" : ""}EXISTING BULLETS:
${existingBullets}

Improved bullets:`;

  try {
    const improved = await improveResumeBullets(prompt);
    const improvedList = improved.split("\n")
      .map(b => b.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    
    return NextResponse.json({ improved: improvedList, original: wh.bullets.map(b => b.content) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}