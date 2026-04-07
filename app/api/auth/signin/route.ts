import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return NextResponse.json({ error: "No account found with this email. Please sign up first." }, { status: 404 });
    }

    // If user has no password hash (old email-only account), prompt them to reset
    if (!user.passwordHash) {
      // Legacy account — set password now to upgrade it
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    } else {
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
      }
    }

    const response = NextResponse.json(
      { success: true, message: "Sign in successful.", userId: user.id },
      { status: 200 }
    );

    response.cookies.set('careeva-session', JSON.stringify({ userId: user.id, email: user.email }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error("Sign in error:", error);
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
