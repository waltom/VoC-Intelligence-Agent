import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoC Intelligence Agent",
  description:
    "Agentic AI system that analyzes public customer reviews and generates business reports.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
