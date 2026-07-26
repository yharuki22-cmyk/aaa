import { describe, it, expect } from "vitest";
import {
  computeStats,
  getWrongHashes,
  pickReviewQuestions,
} from "@/lib/history/stats";
import { filterDuplicates } from "@/lib/quiz/dedup";
import type { AnswerRecord, QuizQuestion } from "@/lib/quiz/types";

function rec(
  hash: string,
  isCorrect: boolean,
  pdf: string,
  cat: AnswerRecord["category"],
  answeredAt: number
): AnswerRecord {
  return {
    hash,
    question: `q-${hash}`,
    selectedIndex: 0,
    correctIndex: isCorrect ? 0 : 1,
    isCorrect,
    sourcePdf: pdf,
    sourcePage: 1,
    category: cat,
    answeredAt,
  };
}

function makeQ(hash: string): QuizQuestion {
  return {
    hash,
    question: `問題${hash}`,
    choices: ["A", "B", "C", "D"],
    correctIndex: 0,
    explanation: "解説",
    distractorReasons: ["r1", "r2", "r3"],
    sourcePdf: "a.pdf",
    sourcePage: 1,
    sourceQuote: "原文",
    category: "term",
    generatedBy: "local",
  };
}

describe("学習履歴の集計", () => {
  const records: AnswerRecord[] = [
    rec("h1", true, "a.pdf", "term", 1),
    rec("h2", false, "a.pdf", "number", 2),
    rec("h3", true, "b.pdf", "material", 3),
    rec("h4", false, "b.pdf", "feature", 4),
  ];

  it("総回答数・正解数・正答率を集計すること", () => {
    const s = computeStats(records);
    expect(s.totalAnswered).toBe(4);
    expect(s.totalCorrect).toBe(2);
    expect(s.accuracy).toBeCloseTo(0.5);
  });

  it("PDF別・分野別の集計ができること", () => {
    const s = computeStats(records);
    expect(s.byPdf["a.pdf"]).toEqual({ answered: 2, correct: 1 });
    expect(s.byCategory["material"]).toEqual({ answered: 1, correct: 1 });
  });

  it("履歴リセット後（空）は統計がゼロになること", () => {
    const s = computeStats([]);
    expect(s.totalAnswered).toBe(0);
    expect(s.totalCorrect).toBe(0);
    expect(s.accuracy).toBe(0);
  });

  it("間違えた問題のハッシュを抽出すること（後で正解したものは除外）", () => {
    const withRetry = [
      ...records,
      rec("h2", true, "a.pdf", "number", 10), // h2 は後で正解
    ];
    const wrong = getWrongHashes(withRetry);
    expect(wrong.has("h4")).toBe(true);
    expect(wrong.has("h2")).toBe(false); // 最新が正解なので除外
    expect(wrong.has("h1")).toBe(false);
  });

  it("復習モードで間違えた問題だけを最大10問抽出すること", () => {
    const pool = ["h1", "h2", "h3", "h4"].map(makeQ);
    const review = pickReviewQuestions(pool, records, 10);
    const hashes = review.map((q) => q.hash).sort();
    expect(hashes).toEqual(["h2", "h4"]);
  });
});

describe("重複排除", () => {
  it("除外ハッシュに含まれる問題を取り除くこと", () => {
    const qs = ["a", "b", "c"].map(makeQ);
    const filtered = filterDuplicates(qs, new Set(["b"]));
    expect(filtered.map((q) => q.hash)).toEqual(["a", "c"]);
  });
});
