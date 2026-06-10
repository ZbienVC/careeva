/**
 * lib/session.ts
 *
 * Signed, tamper-proof session cookies.
 *
 * The session cookie value is `<payloadB64Url>.<hmacSha256B64Url>`. The HMAC is
 * computed over the payload using SESSION_SECRET (falling back to NEXTAUTH_SECRET).
 * verifySessionToken recomputes the HMAC and timing-safe compares it, so a client
 * cannot forge or alter { userId, email } without the secret. A 30-day issued-at
 * expiry is also enforced server-side.
 *
 * Required env: SESSION_SECRET (or NEXTAUTH_SECRET) — 32+ random chars.
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const SESSION_COOKIE_NAME = 'careeva-session';
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SEC * 1000;

export interface CareevaSessionData {
  userId: string;
  email: string;
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'SESSION_SECRET (or NEXTAUTH_SECRET) must be set to a strong value (32+ chars) to issue sessions.'
    );
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Create a signed session token for { userId, email }. */
export function createSessionToken(data: CareevaSessionData): string {
  const payload = b64url(JSON.stringify({ userId: data.userId, email: data.email, iat: Date.now() }));
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Verify a signed session token. Returns null if missing, malformed, forged, or expired. */
export function verifySessionToken(token?: string | null): CareevaSessionData | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    // No secret configured: refuse all sessions rather than trusting unsigned data.
    return null;
  }

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!json?.userId || !json?.email) return null;
    if (typeof json.iat === 'number' && Date.now() - json.iat > SESSION_MAX_AGE_MS) return null;
    return { userId: String(json.userId), email: String(json.email) };
  } catch {
    return null;
  }
}

/** Back-compat alias: parse + verify a raw cookie value. */
export function parseCareevaSession(value?: string | null): CareevaSessionData | null {
  return verifySessionToken(value);
}

// ─── Cookie helpers (single source of truth for name + options) ────────────────

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

/** Attach a fresh signed session cookie to a response (used by signin/signup). */
export function attachSession(response: NextResponse, data: CareevaSessionData): void {
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(data), cookieOptions(SESSION_MAX_AGE_SEC));
}

/** Clear the session cookie (used by signout). */
export function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', cookieOptions(0));
}

// ─── Readers ───────────────────────────────────────────────────────────────────

export function getSessionFromRequest(request: NextRequest): CareevaSessionData | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export async function getSessionFromCookies(): Promise<CareevaSessionData | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
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
