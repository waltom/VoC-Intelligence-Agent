"use client";

import { AlertTriangle, Info, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function FreeQuotaBanner({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="container-narrow mt-4">
      <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-muted/40 p-4 text-sm text-zinc-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <div className="flex-1">
          <p className="font-medium">Limit darmowego tieru bliski wyczerpania</p>
          <p className="mt-1 text-zinc-600">{message}</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-zinc-500 hover:bg-warn-muted/60"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-zinc-200 bg-zinc-900 text-zinc-50">
      <div className="container-narrow flex items-center gap-3 py-2 text-sm">
        <Info className="h-4 w-4" />
        <span>Tryb demo — pokazuję przykładową analizę.</span>
        <a href="/analyses/new" className="ml-auto underline-offset-4 hover:underline">
          Spróbuj własnej →
        </a>
      </div>
    </div>
  );
}

export function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-bad/30 bg-bad-muted/40 p-4 text-sm",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
      <p className="text-zinc-800">{message}</p>
    </div>
  );
}
