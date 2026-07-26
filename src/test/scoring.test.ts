import { describe, it, expect } from "vitest";
import { scoreQuiz, toAnswerRecords } from "@/lib/quiz/scoring";
import type { QuizQuestion } from "@/lib/quiz/types";

function q(hash: string, correctIndex: number): QuizQuestion {
  return {
    hash,
    question: `問題${hash}`,
    choices: ["A選択", "B選択", "C選択", "D選択"],
    correctIndex,
    explanation: "解説",
    distractorReasons: ["r1", "r2", "r3"],
    sourcePdf: "test.pdf",
    sourcePage: 1,
    sourceQuote: "原文",
    category: "term",
    generatedBy: "local",
  };
}

describe("採点", () => {
  const questions = [q("h1", 0), q("h2", 1), q("h3", 2), q("h4", 3)];

  it("正解数・正答率が正しく計算されること", () => {
    const selections = [0, 1, 0, 3]; // 3問正解（h3が不正解）
    const r = scoreQuiz(questions, selections);
    expect(r.total).toBe(4);
    expect(r.correct).toBe(3);
    expect(r.accuracy).toBeCloseTo(3 / 4);
    expect(r.unanswered.length).toBe(0);
    expect(r.graded[2].isCorrect).toBe(false);
    expect(r.graded[0].isCorrect).toBe(true);
  });

  it("未回答が検出されること", () => {
    const selections = [0, null, 2, undefined];
    const r = scoreQuiz(questions, selections);
    expect(r.unanswered).toEqual([1, 3]);
    expect(r.correct).toBe(2);
  });

  it("全問正解で正答率100%になること", () => {
    const r = scoreQuiz(questions, [0, 1, 2, 3]);
    expect(r.correct).toBe(4);
    expect(r.accuracy).toBe(1);
  });

  it("回答レコードへ変換できること", () => {
    const r = scoreQuiz(questions, [0, 0, 0, 0]);
    const records = toAnswerRecords(r);
    expect(records.length).toBe(4);
    expect(records[0].isCorrect).toBe(true);
    expect(records[1].isCorrect).toBe(false);
    expect(records[0].hash).toBe("h1");
  });
});
