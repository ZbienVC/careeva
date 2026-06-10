import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { attachSession } from "@/lib/session";
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

    // SECURITY FIX: previously a legacy (no-password) account accepted ANY
    // typed password as its new password — an account-takeover path. Legacy
    // accounts must now go through signup again (same email, sets password
    // explicitly) rather than being claimable at signin.
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account predates password login. Please use Sign Up with this email to set your password.' },
        { status: 409 }
      );
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

    attachSession(response, { userId: user.id, email: user.email });

    return response;
  } catch (error) {
    console.error("Sign in error:", error);
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
