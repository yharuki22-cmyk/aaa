import { describe, it, expect } from "vitest";
import {
  generateLocalQuestions,
  mulberry32,
} from "@/lib/quiz/localGenerator";
import { hasOverlap } from "@/lib/quiz/dedup";
import { makeTestSegments } from "./fixtures";

describe("ローカル問題生成", () => {
  it("10問生成されること", () => {
    const segs = makeTestSegments();
    const { questions } = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(1),
    });
    expect(questions.length).toBe(10);
  });

  it("各問題に4つの選択肢があること", () => {
    const segs = makeTestSegments();
    const { questions } = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(2),
    });
    for (const q of questions) {
      expect(q.choices.length).toBe(4);
      // 選択肢がすべて非空・重複なし
      const set = new Set(q.choices.map((c) => c.trim()));
      expect(set.size).toBe(4);
    }
  });

  it("各問題の正解がちょうど1つであること", () => {
    const segs = makeTestSegments();
    const { questions } = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(3),
    });
    for (const q of questions) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
      // 正解テキストは選択肢の中に必ず存在する
      expect(q.choices[q.correctIndex]).toBeTruthy();
    }
  });

  it("解説とPDFの出典（PDF名・ページ・原文抜粋）が含まれること", () => {
    const segs = makeTestSegments();
    const { questions } = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(4),
    });
    for (const q of questions) {
      expect(q.explanation.length).toBeGreaterThan(0);
      expect(q.sourcePdf.length).toBeGreaterThan(0);
      expect(q.sourcePage).toBeGreaterThanOrEqual(1);
      expect(q.sourceQuote.length).toBeGreaterThan(0);
      expect(q.distractorReasons.length).toBe(3);
    }
  });

  it("正解位置がA〜Dにある程度分散していること", () => {
    const segs = makeTestSegments();
    const { questions } = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(5),
    });
    const counts = [0, 0, 0, 0];
    for (const q of questions) counts[q.correctIndex]++;
    // すべてが1つの位置に偏っていない（最大でも過半数未満程度）
    expect(Math.max(...counts)).toBeLessThan(questions.length);
  });

  it("更新時に直近の問題と重複しないこと", () => {
    const segs = makeTestSegments();
    const first = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(10),
    });
    const excludeHashes = new Set(first.questions.map((q) => q.hash));
    const second = generateLocalQuestions(segs, {
      count: 10,
      excludeHashes,
      rng: mulberry32(20),
    });
    expect(second.questions.length).toBeGreaterThan(0);
    // 直近セットと重複がないこと
    expect(hasOverlap(first.questions, second.questions)).toBe(false);
  });

  it("題材が不足する場合はメッセージを返すこと", () => {
    const segs = makeTestSegments().slice(0, 2);
    const { questions, note } = generateLocalQuestions(segs, {
      count: 10,
      rng: mulberry32(7),
    });
    expect(questions.length).toBeLessThan(10);
    expect(note).toBeTruthy();
  });
});
