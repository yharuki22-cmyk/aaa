"use client";

import { useQuizApp } from "@/lib/store/useQuizApp";
import { PdfUploader } from "@/components/PdfUploader";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { QuestionCard } from "@/components/QuestionCard";
import { ResultSummary } from "@/components/ResultSummary";
import { HistoryPanel } from "@/components/HistoryPanel";

export default function Home() {
  const app = useQuizApp();

  const hasQuestions = app.questions.length > 0;
  const busy = app.generating || app.processing;

  return (
    <div className="min-h-screen">
      <header className="border-b border-base-line bg-base-surface">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-xl font-bold text-base-ink sm:text-2xl">
            建築材料学 4択問題演習
          </h1>
          <p className="mt-1 text-sm text-base-muted">
            PDFの線引き・ハイライト箇所を優先して、毎回異なる4択問題を10問出題します。
            {app.aiConfigured ? (
              <span className="ml-1 text-amber-700">（AI生成モード）</span>
            ) : (
              <span className="ml-1">（ローカル生成モード）</span>
            )}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        {/* メインカラム */}
        <div className="space-y-6 lg:col-span-2">
          <PdfUploader
            analyses={app.analyses}
            processing={app.processing}
            aiConfigured={app.aiConfigured}
            maxFileSizeLabel={app.maxFileSizeLabel}
            onUpload={app.uploadFiles}
            onRemove={app.removeAnalysis}
          />

          <ProcessingStatus progress={app.progress} />

          {app.error && (
            <div
              className="rounded-lg border border-incorrect bg-red-50 p-4 text-sm text-incorrect"
              role="alert"
            >
              <div className="flex items-start justify-between gap-2">
                <span>⚠ {app.error}</span>
                <button
                  type="button"
                  onClick={() => app.setError(null)}
                  className="shrink-0 text-xs underline"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* 出題コントロール */}
          <section className="rounded-xl border border-base-line bg-base-surface p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-base-ink">
              2. 問題を出題
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={app.generateNext}
                disabled={busy || app.analyses.length === 0}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {app.generating
                  ? "生成中…"
                  : hasQuestions
                    ? "問題を更新（次の10問）"
                    : "10問を出題する"}
              </button>
              {hasQuestions && !app.graded && (
                <button
                  type="button"
                  onClick={app.grade}
                  disabled={busy}
                  className="rounded-md bg-brand-dark px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  答え合わせ
                </button>
              )}
              {app.graded && (
                <button
                  type="button"
                  onClick={app.retry}
                  className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand-dark transition hover:bg-brand/5"
                >
                  この問題に再挑戦
                </button>
              )}
            </div>

            {app.genNote && (
              <p className="mt-3 rounded-md bg-base-bg p-2 text-sm text-base-muted">
                ℹ {app.genNote}
              </p>
            )}
            {app.mode === "review" && hasQuestions && (
              <p className="mt-2 text-sm font-medium text-brand-dark">
                🔁 復習モードで出題中
              </p>
            )}
          </section>

          {/* 採点結果サマリ */}
          {app.graded && <ResultSummary result={app.graded} />}

          {/* 未回答の警告 */}
          {app.unansweredWarning.length > 0 && (
            <div
              className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800"
              role="alert"
            >
              未回答の問題があります（第
              {app.unansweredWarning.map((i) => i + 1).join("・")}問）。
              すべて回答してから「答え合わせ」を押してください。
            </div>
          )}

          {/* 問題一覧 */}
          {hasQuestions && (
            <div className="space-y-4">
              {app.questions.map((q, i) => (
                <QuestionCard
                  key={q.hash + i}
                  index={i}
                  question={q}
                  selected={app.selections[i] ?? null}
                  graded={app.graded !== null}
                  isUnanswered={app.unansweredWarning.includes(i)}
                  onSelect={(choiceIndex) => app.select(i, choiceIndex)}
                />
              ))}

              {/* 下部にも答え合わせ/更新ボタン */}
              <div className="flex flex-wrap gap-2 pb-8">
                {!app.graded ? (
                  <button
                    type="button"
                    onClick={app.grade}
                    disabled={busy}
                    className="rounded-md bg-brand-dark px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    答え合わせ
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={app.retry}
                      className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand-dark transition hover:bg-brand/5"
                    >
                      再挑戦
                    </button>
                    <button
                      type="button"
                      onClick={app.generateNext}
                      disabled={busy}
                      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
                    >
                      次の10問
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* サイドバー */}
        <aside className="space-y-6">
          <HistoryPanel
            stats={app.stats}
            onReview={app.startReview}
            onReset={app.resetHistory}
            reviewDisabled={busy}
          />
        </aside>
      </main>
    </div>
  );
}
