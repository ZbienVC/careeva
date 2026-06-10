import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

// Initialize transporter only if SMTP is configured
if (
  process.env.EMAIL_SERVER_HOST &&
  process.env.EMAIL_SERVER_USER &&
  process.env.EMAIL_SERVER_PASSWORD
) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
    secure: process.env.EMAIL_SERVER_PORT === "465",
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  userName?: string
) {
  try {
    // In development without SMTP configured, just log the URL
    if (!transporter) {
      const verificationUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/callback/email?token=${token}&email=${encodeURIComponent(email)}`;
      console.log(`[DEV MODE] Verification email for ${email}: ${verificationUrl}`);
      return { success: true };
    }

    const verificationUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/callback/email?token=${token}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@careeva.app",
      to: email,
      subject: "Verify your Careeva account",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Welcome${userName ? ` ${userName}` : ""}!</h2>
          <p>Thank you for signing up for Careeva. Please verify your email address to get started.</p>
          <p>
            <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </p>
          <p style="font-size: 12px; color: #666;">
            Or copy and paste this link: <br/>
            <code>${verificationUrl}</code>
          </p>
          <p style="font-size: 12px; color: #666;">
            This link will expire in 24 hours.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export interface DigestStats {
  newJobs: number;
  queued: number;
  awaitingApproval: number;
  submittedToday: number;
}

/** Daily summary after a scheduled run — what went out, what's waiting. */
export async function sendDailyDigest(email: string, stats: DigestStats) {
  try {
    if (!transporter) {
      console.log(`[DEV MODE] Daily digest for ${email}:`, JSON.stringify(stats));
      return { success: true };
    }

    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const line = (label: string, value: number) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#74614a;">${label}</td><td style="padding:6px 0;font-weight:700;color:#261c10;">${value}</td></tr>`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@careeva.app",
      to: email,
      subject: stats.awaitingApproval > 0
        ? `Careeva: ${stats.awaitingApproval} application${stats.awaitingApproval > 1 ? "s" : ""} waiting for your approval`
        : `Careeva daily summary: ${stats.submittedToday} submitted, ${stats.queued} queued`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #261c10;">
          <h2 style="font-weight: 600;">Your job search ran today.</h2>
          <table style="font-family: Arial, sans-serif; font-size: 14px; border-collapse: collapse;">
            ${line("New jobs found", stats.newJobs)}
            ${line("Applications queued", stats.queued)}
            ${line("Waiting for your approval", stats.awaitingApproval)}
            ${line("Submitted today", stats.submittedToday)}
          </table>
          ${stats.awaitingApproval > 0 ? `
          <p style="font-family: Arial, sans-serif; font-size: 14px;">
            <a href="${appUrl}/dashboard/review" style="background:#a63d17;color:#faf5eb;padding:10px 20px;text-decoration:none;border-radius:10px;display:inline-block;">
              Review &amp; approve
            </a>
          </p>` : `
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #74614a;">
            Nothing needs you right now. <a href="${appUrl}/dashboard" style="color:#a63d17;">Open Careeva</a>
          </p>`}
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending daily digest:", error);
    return { success: false };
  }
}

export async function sendWelcomeEmail(email: string, userName?: string) {
  try {
    // In development without SMTP configured, just log
    if (!transporter) {
      console.log(`[DEV MODE] Welcome email sent to ${email}`);
      return { success: true };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@careeva.app",
      to: email,
      subject: "Welcome to Careeva",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Welcome${userName ? ` ${userName}` : ""}!</h2>
          <p>Your Careeva account has been successfully created.</p>
          <p>You can now start uploading your resume and discovering job opportunities tailored to your skills.</p>
          <p style="margin-top: 30px;">
            <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Go to Dashboard
            </a>
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
}
