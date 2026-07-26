// 学習履歴の集計ロジック（純粋関数）

import type { AnswerRecord, HistoryStats, QuizQuestion } from "../quiz/types";

/** 回答レコードから統計を集計 */
export function computeStats(records: AnswerRecord[]): HistoryStats {
  const byPdf: HistoryStats["byPdf"] = {};
  const byCategory: HistoryStats["byCategory"] = {};
  let totalCorrect = 0;

  for (const r of records) {
    if (r.isCorrect) totalCorrect++;
    const p = (byPdf[r.sourcePdf] ??= { answered: 0, correct: 0 });
    p.answered++;
    if (r.isCorrect) p.correct++;
    const c = (byCategory[r.category] ??= { answered: 0, correct: 0 });
    c.answered++;
    if (r.isCorrect) c.correct++;
  }

  const totalAnswered = records.length;
  return {
    totalAnswered,
    totalCorrect,
    accuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
    byPdf,
    byCategory,
  };
}

/**
 * 間違えた問題のハッシュ集合を返す。
 * ただし、その後正解している問題は除外する（最新の結果を優先）。
 */
export function getWrongHashes(records: AnswerRecord[]): Set<string> {
  // hashごとに最新の回答結果を求める
  const latest = new Map<string, AnswerRecord>();
  for (const r of records) {
    const prev = latest.get(r.hash);
    if (!prev || r.answeredAt >= prev.answeredAt) latest.set(r.hash, r);
  }
  const wrong = new Set<string>();
  for (const [hash, r] of latest) {
    if (!r.isCorrect) wrong.add(hash);
  }
  return wrong;
}

/**
 * 復習モード用に、間違えた問題を最大 limit 問だけ抽出する。
 * 与えられた問題プールの中から、間違いハッシュに一致するものを返す。
 */
export function pickReviewQuestions(
  pool: QuizQuestion[],
  records: AnswerRecord[],
  limit = 10
): QuizQuestion[] {
  const wrong = getWrongHashes(records);
  const seen = new Set<string>();
  const out: QuizQuestion[] = [];
  for (const q of pool) {
    if (out.length >= limit) break;
    if (wrong.has(q.hash) && !seen.has(q.hash)) {
      seen.add(q.hash);
      out.push(q);
    }
  }
  return out;
}
