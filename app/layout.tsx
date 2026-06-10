import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// "Kiln" type system — editorial serif display, characterful humanist body,
// mono for spec-sheet labels and figures.
const body = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});

const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Careeva — AI Job Search Assistant",
    template: "%s · Careeva",
  },
  description:
    "Upload your resume, answer a few questions, and let Careeva find, score, and apply to the right jobs for you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3ecdd",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${body.variable} ${fraunces.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
