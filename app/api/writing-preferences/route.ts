import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await prisma.writingPreferences.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ prefs });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const prefs = await prisma.writingPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...body },
    update: body,
  });
  return NextResponse.json({ prefs });
}