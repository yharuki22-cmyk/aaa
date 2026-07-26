"use client";

import type { ProcessProgress } from "@/lib/pdf/extract";

export function ProcessingStatus({
  progress,
}: {
  progress: ProcessProgress | null;
}) {
  if (!progress) return null;
  return (
    <div
      className="rounded-lg border border-brand/30 bg-brand/5 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-brand-dark">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <span>
          解析中… {progress.pdfName ? `（${progress.pdfName}）` : ""}
        </span>
      </div>
      <p className="mt-1 text-sm text-base-muted">{progress.stage}</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-base-line">
        <div
          className="h-full bg-brand transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
        />
      </div>
    </div>
  );
}
