import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    // Validate input
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered. Please sign in instead" },
        { status: 409 }
      );
    }

    // Create new user with email verified
    const user = await prisma.user.create({
      data: {
        email,
        name: name && typeof name === "string" ? name : undefined,
        emailVerified: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created. You can now sign in.",
        email: user.email,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json(
      { error: "Sign up failed. Please try again" },
      { status: 500 }
    );
  }
}
