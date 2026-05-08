import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "VoC Intelligence Agent",
  description:
    "Agentowy system AI, który analizuje publiczne opinie klientów i generuje raport biznesowy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <Providers>
          <header className="border-b border-zinc-200 bg-white">
            <div className="container-narrow flex h-14 items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span>VoC Agent</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link href="/analyses" className="button-ghost">
                  Analizy
                </Link>
                <Link href="/analyses/new" className="button-primary h-8 px-3 py-1.5">
                  Nowa analiza
                </Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="container-narrow mt-24 border-t border-zinc-200 py-8 text-xs text-zinc-500">
            VoC Intelligence Agent · portfolio project · Cloudflare Workers + Gemini + Workers AI
          </footer>
        </Providers>
      </body>
    </html>
  );
}
