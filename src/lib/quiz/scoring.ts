// 採点ロジック

import type { QuizQuestion, AnswerRecord } from "./types";

export interface GradedQuestion {
  question: QuizQuestion;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export interface ScoreResult {
  total: number;
  correct: number;
  /** 0-1 の正答率 */
  accuracy: number;
  graded: GradedQuestion[];
  /** 未回答の問題番号（0始まりのindex） */
  unanswered: number[];
}

/**
 * 回答（選択index配列）を採点する。
 * selections[i] が null または undefined の問題は未回答とみなす。
 */
export function scoreQuiz(
  questions: QuizQuestion[],
  selections: Array<number | null | undefined>
): ScoreResult {
  const graded: GradedQuestion[] = [];
  const unanswered: number[] = [];
  let correct = 0;

  questions.forEach((q, i) => {
    const sel = selections[i];
    const selectedIndex = sel === null || sel === undefined ? null : sel;
    if (selectedIndex === null) unanswered.push(i);
    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) correct++;
    graded.push({ question: q, selectedIndex, isCorrect });
  });

  const total = questions.length;
  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    graded,
    unanswered,
  };
}

/** 採点結果を履歴用の回答レコードに変換 */
export function toAnswerRecords(result: ScoreResult): AnswerRecord[] {
  const now = Date.now();
  return result.graded.map((g) => ({
    hash: g.question.hash,
    question: g.question.question,
    selectedIndex: g.selectedIndex,
    correctIndex: g.question.correctIndex,
    isCorrect: g.isCorrect,
    sourcePdf: g.question.sourcePdf,
    sourcePage: g.question.sourcePage,
    category: g.question.category,
    answeredAt: now,
  }));
}
