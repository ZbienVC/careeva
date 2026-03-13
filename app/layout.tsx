import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Careeva - Job Search Assistant",
  description: "AI-powered job search and application assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
