import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

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

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name: name && typeof name === "string" ? name : undefined,
      },
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");

    // Send verification email
    try {
      await sendVerificationEmail(email, token, name);
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Log error but don't fail - user is created, they just won't receive the email
      // In production, you might want to queue this for retry or alert admins
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created. Check your email for verification link",
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
