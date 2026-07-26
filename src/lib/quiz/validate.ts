// AI（またはローカル）が生成した問題の検証。
// 不正な問題（正解番号が範囲外・選択肢が4つでない・正解が複数など）は破棄する。

import { quizQuestionSchema } from "./schema";
import type { QuizQuestion } from "./types";
import { computeQuestionHash } from "./hash";

export interface ValidationOutcome {
  valid: QuizQuestion[];
  /** 破棄した問題の理由一覧（デバッグ・表示用） */
  rejected: Array<{ reason: string }>;
}

/**
 * 生の問題配列を検証し、正しいものだけを返す。
 * - Zodスキーマで構造検証（選択肢4つ・正解番号0-3・重複選択肢の排除など）
 * - hash が無ければ内容から補完
 */
export function validateQuestions(raw: unknown): ValidationOutcome {
  const valid: QuizQuestion[] = [];
  const rejected: Array<{ reason: string }> = [];

  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as any).questions)
      ? (raw as any).questions
      : null;

  if (!arr) {
    return { valid, rejected: [{ reason: "問題配列が見つかりませんでした。" }] };
  }

  for (const item of arr) {
    // hash が欠けている場合は内容から補完してから検証
    const withHash =
      item && typeof item === "object" && !(item as any).hash
        ? {
            ...(item as any),
            hash:
              Array.isArray((item as any).choices) &&
              typeof (item as any).correctIndex === "number"
                ? computeQuestionHash({
                    question: String((item as any).question ?? ""),
                    choices: (item as any).choices.map((c: unknown) => String(c)),
                    correctText: String(
                      (item as any).choices[(item as any).correctIndex] ?? ""
                    ),
                  })
                : "",
          }
        : item;

    const parsed = quizQuestionSchema.safeParse(withHash);
    if (!parsed.success) {
      rejected.push({
        reason: parsed.error.issues.map((i) => i.message).join(", "),
      });
      continue;
    }
    const q = parsed.data;
    // 誤答理由の数を選択肢数-1に整える
    const reasons = [...q.distractorReasons];
    while (reasons.length < 3) reasons.push("PDFの記載に該当しません。");
    valid.push({
      hash: q.hash,
      question: q.question,
      choices: q.choices as [string, string, string, string],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      distractorReasons: reasons.slice(0, 3),
      sourcePdf: q.sourcePdf,
      sourcePage: q.sourcePage,
      sourceQuote: q.sourceQuote,
      category: q.category,
      generatedBy: q.generatedBy,
    });
  }

  return { valid, rejected };
}
