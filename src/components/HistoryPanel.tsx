"use client";

import type { HistoryStats } from "@/lib/quiz/types";

const CATEGORY_LABEL: Record<string, string> = {
  term: "用語",
  feature: "特徴・性質",
  use: "用途",
  material: "原材料",
  process: "製造・施工",
  number: "数値",
  comparison: "材料比較",
  understanding: "理解確認",
};

function pct(correct: number, answered: number): string {
  if (answered === 0) return "-";
  return `${Math.round((correct / answered) * 100)}%`;
}

export function HistoryPanel({
  stats,
  onReview,
  onReset,
  reviewDisabled,
}: {
  stats: HistoryStats | null;
  onReview: () => void;
  onReset: () => void;
  reviewDisabled: boolean;
}) {
  if (!stats) return null;
  const overallPct = Math.round(stats.accuracy * 100);
  const pdfEntries = Object.entries(stats.byPdf);
  const catEntries = Object.entries(stats.byCategory);

  return (
    <section className="rounded-xl border border-base-line bg-base-surface p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-base-ink">学習履歴</h2>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-base-bg p-3">
          <p className="text-xs text-base-muted">総回答数</p>
          <p className="text-xl font-bold text-base-ink">
            {stats.totalAnswered}
          </p>
        </div>
        <div className="rounded-lg bg-base-bg p-3">
          <p className="text-xs text-base-muted">正解数</p>
          <p className="text-xl font-bold text-correct">{stats.totalCorrect}</p>
        </div>
        <div className="rounded-lg bg-base-bg p-3">
          <p className="text-xs text-base-muted">正答率</p>
          <p className="text-xl font-bold text-brand-dark">
            {stats.totalAnswered > 0 ? `${overallPct}%` : "-"}
          </p>
        </div>
      </div>

      {pdfEntries.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold text-base-ink">
            PDF別の正答率
          </h3>
          <ul className="space-y-1 text-sm">
            {pdfEntries.map(([name, v]) => (
              <li key={name} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-base-muted">{name}</span>
                <span className="shrink-0 font-medium text-base-ink">
                  {pct(v.correct, v.answered)}（{v.correct}/{v.answered}）
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {catEntries.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold text-base-ink">
            分野別の正答率
          </h3>
          <ul className="space-y-1 text-sm">
            {catEntries.map(([cat, v]) => (
              <li key={cat} className="flex justify-between gap-2">
                <span className="text-base-muted">
                  {CATEGORY_LABEL[cat] ?? cat}
                </span>
                <span className="font-medium text-base-ink">
                  {pct(v.correct, v.answered)}（{v.correct}/{v.answered}）
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReview}
          disabled={reviewDisabled}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          復習モード（間違えた問題）
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-incorrect px-4 py-2 text-sm font-medium text-incorrect transition hover:bg-red-50"
        >
          出題履歴をリセット
        </button>
      </div>
    </section>
  );
}
