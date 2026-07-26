"use client";

import type { ScoreResult } from "@/lib/quiz/scoring";

export function ResultSummary({ result }: { result: ScoreResult }) {
  const pct = Math.round(result.accuracy * 100);
  return (
    <div
      className="sticky top-0 z-10 rounded-xl border border-brand/40 bg-base-surface p-4 shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold text-base-ink">
          結果: {result.total}問中{" "}
          <span className="text-brand-dark">{result.correct}</span>問正解
        </p>
        <p className="text-lg font-bold text-brand-dark">正答率 {pct}%</p>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-base-line">
        <div
          className="h-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
