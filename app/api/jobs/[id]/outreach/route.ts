import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generateLinkedInOutreach } from '@/lib/linkedin-outreach';
import type { ContactType } from '@/lib/linkedin-outreach';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(req);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: jobId } = await params;
  const body = await req.json();
  const { contactType, contactName } = body as { contactType: ContactType; contactName?: string };

  if (!contactType) return NextResponse.json({ error: 'contactType required' }, { status: 400 });

  try {
    const message = await generateLinkedInOutreach(jobId, user.id, contactType, contactName);
    return NextResponse.json({ message, charCount: message.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
