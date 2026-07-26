import { z } from "zod";

/**
 * AI（またはローカル生成）が返す1問のスキーマ。
 * 仕様: 問題文, 4つの選択肢, 正解番号, 解説, 各誤答の誤り理由,
 *       出典PDF名, ページ番号, 根拠原文, 問題識別用ハッシュ を含む。
 */
export const quizQuestionSchema = z
  .object({
    hash: z.string().min(1),
    question: z.string().min(1),
    choices: z
      .array(z.string().min(1))
      .length(4, { message: "選択肢はちょうど4つ必要です" }),
    correctIndex: z
      .number()
      .int()
      .min(0, { message: "正解番号は0以上4未満である必要があります" })
      .max(3, { message: "正解番号は0以上4未満である必要があります" }),
    explanation: z.string().min(1),
    distractorReasons: z.array(z.string()),
    sourcePdf: z.string().min(1),
    sourcePage: z.number().int().min(1),
    sourceQuote: z.string().min(1),
    category: z.enum([
      "term",
      "feature",
      "use",
      "material",
      "process",
      "number",
      "comparison",
      "understanding",
    ]),
    generatedBy: z.enum(["local", "ai"]).default("ai"),
  })
  .superRefine((val, ctx) => {
    // 選択肢が重複していないこと（正解が実質複数になるのを防ぐ）
    const normalized = val.choices.map((c) => c.trim());
    const unique = new Set(normalized);
    if (unique.size !== normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "選択肢が重複しています（正解が複数存在する可能性）",
        path: ["choices"],
      });
    }
    // 空文字の選択肢を弾く
    if (normalized.some((c) => c.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "空の選択肢があります",
        path: ["choices"],
      });
    }
  });

export type ValidatedQuizQuestion = z.infer<typeof quizQuestionSchema>;

/** AIレスポンス全体（複数問） */
export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema),
});

export type QuizResponse = z.infer<typeof quizResponseSchema>;
