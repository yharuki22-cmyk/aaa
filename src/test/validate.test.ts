import { describe, it, expect } from "vitest";
import { validateQuestions } from "@/lib/quiz/validate";

const validQuestion = {
  hash: "abc123",
  question: "コンクリートの圧縮強度の説明として正しいものは？",
  choices: ["24MPa", "240MPa", "2.4MPa", "0.24MPa"],
  correctIndex: 0,
  explanation: "PDFに24MPaと記載されている。",
  distractorReasons: ["誤り1", "誤り2", "誤り3"],
  sourcePdf: "materials.pdf",
  sourcePage: 3,
  sourceQuote: "圧縮強度は24MPa",
  category: "number",
  generatedBy: "ai",
};

describe("AI応答の検証", () => {
  it("正しい問題を受理すること", () => {
    const { valid, rejected } = validateQuestions({
      questions: [validQuestion],
    });
    expect(valid.length).toBe(1);
    expect(rejected.length).toBe(0);
  });

  it("選択肢が4つでない問題を破棄すること", () => {
    const bad = { ...validQuestion, choices: ["A", "B", "C"] };
    const { valid, rejected } = validateQuestions({ questions: [bad] });
    expect(valid.length).toBe(0);
    expect(rejected.length).toBe(1);
  });

  it("正解番号が範囲外の問題を破棄すること", () => {
    const bad = { ...validQuestion, correctIndex: 5 };
    const { valid, rejected } = validateQuestions({ questions: [bad] });
    expect(valid.length).toBe(0);
    expect(rejected.length).toBe(1);
  });

  it("選択肢が重複し正解が複数になりうる問題を破棄すること", () => {
    const bad = {
      ...validQuestion,
      choices: ["24MPa", "24MPa", "2.4MPa", "0.24MPa"],
    };
    const { valid, rejected } = validateQuestions({ questions: [bad] });
    expect(valid.length).toBe(0);
    expect(rejected.length).toBe(1);
  });

  it("必須項目（出典など）が欠けた問題を破棄すること", () => {
    const bad = { ...validQuestion, sourcePdf: "" };
    const { valid, rejected } = validateQuestions({ questions: [bad] });
    expect(valid.length).toBe(0);
    expect(rejected.length).toBe(1);
  });

  it("正しい問題と不正な問題が混在しても正しいものだけ受理すること", () => {
    const bad = { ...validQuestion, correctIndex: 9 };
    const { valid, rejected } = validateQuestions({
      questions: [validQuestion, bad, validQuestion],
    });
    expect(valid.length).toBe(2);
    expect(rejected.length).toBe(1);
  });

  it("配列でない・不正な入力を破棄すること", () => {
    const { valid, rejected } = validateQuestions({ nonsense: true });
    expect(valid.length).toBe(0);
    expect(rejected.length).toBeGreaterThan(0);
  });
});
