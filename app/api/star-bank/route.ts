import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { getStories, addStories } from '@/lib/star-bank';

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stories = await getStories(user.id);
  return NextResponse.json({ stories });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { stories, jobId } = await req.json();
  if (!Array.isArray(stories)) return NextResponse.json({ error: 'stories array required' }, { status: 400 });

  await addStories(user.id, stories, jobId);
  return NextResponse.json({ added: stories.length });
}
