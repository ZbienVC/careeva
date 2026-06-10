import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { attachSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      // Legacy passwordless account: allow claiming it HERE (explicit signup
      // intent) rather than at signin. Accounts that already have a password
      // are still rejected.
      if (!existingUser.passwordHash) {
        const passwordHash = await bcrypt.hash(password, 12);
        const upgraded = await prisma.user.update({
          where: { id: existingUser.id },
          data: { passwordHash, name: name && typeof name === "string" ? name.trim() : existingUser.name },
        });
        const response = NextResponse.json(
          { success: true, message: "Password set for existing account.", userId: upgraded.id },
          { status: 200 }
        );
        attachSession(response, { userId: upgraded.id, email: upgraded.email });
        return response;
      }
      return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name && typeof name === "string" ? name.trim() : undefined,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    const response = NextResponse.json(
      { success: true, message: "Account created successfully.", userId: user.id },
      { status: 201 }
    );

    attachSession(response, { userId: user.id, email: user.email });

    return response;
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json({ error: "Sign up failed. Please try again." }, { status: 500 });
  }
}
