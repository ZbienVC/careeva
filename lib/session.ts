import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

export interface CareevaSessionData {
  userId: string;
  email: string;
}

export function parseCareevaSession(value?: string | null): CareevaSessionData | null {
  if (!value) return null;

  try {
    const session = JSON.parse(value);
    if (!session?.userId || !session?.email) return null;
    return {
      userId: String(session.userId),
      email: String(session.email),
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): CareevaSessionData | null {
  return parseCareevaSession(request.cookies.get('careeva-session')?.value);
}

export async function getSessionFromCookies(): Promise<CareevaSessionData | null> {
  const cookieStore = await cookies();
  return parseCareevaSession(cookieStore.get('careeva-session')?.value);
}

export async function getCurrentUserFromRequest(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.email },
    include: { profile: true },
  });
}

export async function getCurrentUserFromCookies() {
  const session = await getSessionFromCookies();
  if (!session?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.email },
    include: { profile: true },
  });
}
