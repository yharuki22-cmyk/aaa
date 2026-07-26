"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/quiz/types";
import { PdfPreview } from "./PdfPreview";

const LABELS = ["A", "B", "C", "D"] as const;

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

export function QuestionCard({
  index,
  question,
  selected,
  graded,
  isUnanswered,
  onSelect,
}: {
  index: number;
  question: QuizQuestion;
  selected: number | null;
  graded: boolean;
  isUnanswered: boolean;
  onSelect: (choiceIndex: number) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const isCorrectAnswer = graded && selected === question.correctIndex;

  // 誤答理由を「正解以外の選択肢index」に対応付け
  const distractorIndexes = [0, 1, 2, 3].filter(
    (i) => i !== question.correctIndex
  );

  return (
    <article
      className={`rounded-xl border bg-base-surface p-5 shadow-sm ${
        isUnanswered ? "border-amber-400 ring-2 ring-amber-200" : "border-base-line"
      }`}
      id={`question-${index}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-brand/10 px-3 py-0.5 text-sm font-bold text-brand-dark">
          第{index + 1}問
        </span>
        <span className="rounded bg-base-bg px-2 py-0.5 text-xs text-base-muted">
          {CATEGORY_LABEL[question.category] ?? question.category}
        </span>
      </div>

      {isUnanswered && (
        <p className="mb-2 text-sm font-medium text-amber-700">
          ⚠ この問題はまだ回答されていません
        </p>
      )}

      <p className="mb-4 whitespace-pre-wrap text-base font-medium text-base-ink">
        {question.question}
      </p>

      <div className="space-y-2" role="radiogroup" aria-label={`第${index + 1}問の選択肢`}>
        {question.choices.map((choice, i) => {
          const isSelected = selected === i;
          const isCorrect = i === question.correctIndex;

          // 採点後の配色（緑=正解, 赤=不正解、色以外に記号でも判別）
          let cls =
            "border-base-line bg-white hover:border-brand hover:bg-brand/5";
          let mark = "";
          if (graded) {
            if (isCorrect) {
              cls = "border-correct bg-green-50";
              mark = "✔ 正解";
            } else if (isSelected) {
              cls = "border-incorrect bg-red-50";
              mark = "✗ あなたの回答（不正解）";
            } else {
              cls = "border-base-line bg-white opacity-80";
            }
          } else if (isSelected) {
            cls = "border-brand bg-brand/10";
          }

          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={graded}
              onClick={() => onSelect(i)}
              className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition disabled:cursor-default ${cls}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  isSelected
                    ? "border-brand bg-brand text-white"
                    : "border-base-line text-base-muted"
                }`}
              >
                {LABELS[i]}
              </span>
              <span className="flex-1 text-base-ink">{choice}</span>
              {mark && (
                <span
                  className={`shrink-0 text-xs font-bold ${
                    isCorrect ? "text-correct" : "text-incorrect"
                  }`}
                >
                  {mark}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 採点後の解説・根拠 */}
      {graded && (
        <div className="mt-4 space-y-3 rounded-lg bg-base-bg p-4 text-sm">
          <p
            className={`font-bold ${
              isCorrectAnswer ? "text-correct" : "text-incorrect"
            }`}
          >
            {isCorrectAnswer ? "◯ 正解" : "✗ 不正解"} ／ 正しい回答:{" "}
            {LABELS[question.correctIndex]}（
            {question.choices[question.correctIndex]}）
          </p>

          <div>
            <p className="font-semibold text-base-ink">解説</p>
            <p className="text-base-ink">{question.explanation}</p>
          </div>

          {question.distractorReasons.length > 0 && (
            <div>
              <p className="font-semibold text-base-ink">
                他の選択肢が誤りである理由
              </p>
              <ul className="list-inside list-disc text-base-ink">
                {distractorIndexes.map((choiceIdx, k) => (
                  <li key={choiceIdx}>
                    <span className="font-medium">{LABELS[choiceIdx]}:</span>{" "}
                    {question.distractorReasons[k] ?? "PDFの記載に該当しません。"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded border border-base-line bg-white p-3">
            <p className="font-semibold text-base-ink">📚 根拠（出典）</p>
            <p className="text-base-ink">
              PDF: <span className="font-medium">{question.sourcePdf}</span> ／
              ページ: <span className="font-medium">{question.sourcePage}</span>
            </p>
            <p className="mt-1 text-base-muted">
              原文抜粋:「{question.sourceQuote}」
            </p>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="mt-2 rounded border border-brand px-3 py-1 text-xs text-brand-dark hover:bg-brand/5"
            >
              {showPreview ? "ページプレビューを隠す" : "該当ページをプレビュー"}
            </button>
            {showPreview && (
              <div className="mt-3">
                <PdfPreview
                  pdfName={question.sourcePdf}
                  page={question.sourcePage}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
