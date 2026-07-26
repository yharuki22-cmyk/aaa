// クライアント側の問題生成オーケストレーション。
// AIが設定されていればサーバーAPI経由で生成し、無ければ/失敗すればローカル生成にフォールバック。

import type { ExtractedSegment, QuizQuestion } from "./types";
import { generateLocalQuestions } from "./localGenerator";
import { validateQuestions } from "./validate";

export interface GenerateQuizOptions {
  count?: number;
  excludeHashes?: Set<string>;
}

export interface GenerateQuizResult {
  questions: QuizQuestion[];
  usedAi: boolean;
  note?: string;
}

let aiStatusCache: { configured: boolean } | null = null;

export async function checkAiStatus(): Promise<boolean> {
  if (aiStatusCache) return aiStatusCache.configured;
  try {
    const res = await fetch("/api/ai-status");
    if (!res.ok) {
      aiStatusCache = { configured: false };
      return false;
    }
    const data = await res.json();
    aiStatusCache = { configured: Boolean(data.configured) };
    return aiStatusCache.configured;
  } catch {
    aiStatusCache = { configured: false };
    return false;
  }
}

async function generateWithAi(
  segments: ExtractedSegment[],
  count: number,
  excludeHashes: Set<string>
): Promise<QuizQuestion[]> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      segments,
      count,
      excludeHashes: Array.from(excludeHashes),
    }),
  });
  if (!res.ok) throw new Error("ai_generation_failed");
  const data = await res.json();
  // サーバーで検証済みだが、クライアントでも念のため検証
  const { valid } = validateQuestions(data.questions);
  return valid.filter((q) => !excludeHashes.has(q.hash));
}

/**
 * 問題を生成する。AIを優先し、不足分・失敗時はローカル生成で補う。
 */
export async function generateQuiz(
  segments: ExtractedSegment[],
  options: GenerateQuizOptions = {}
): Promise<GenerateQuizResult> {
  const count = options.count ?? 10;
  const excludeHashes = options.excludeHashes ?? new Set<string>();

  const aiConfigured = await checkAiStatus();
  let usedAi = false;
  let questions: QuizQuestion[] = [];
  let note: string | undefined;

  if (aiConfigured) {
    try {
      questions = await generateWithAi(segments, count, excludeHashes);
      usedAi = questions.length > 0;
    } catch {
      note = "AI生成に失敗したため、ローカル生成モードに切り替えました。";
    }
  }

  // 不足分をローカル生成で補完（AIが0件/一部の場合も含む）
  if (questions.length < count) {
    const already = new Set<string>([
      ...excludeHashes,
      ...questions.map((q) => q.hash),
    ]);
    const local = generateLocalQuestions(segments, {
      count: count - questions.length,
      excludeHashes: already,
    });
    questions = [...questions, ...local.questions];
    if (local.note && questions.length < count) {
      note = note ? `${note} ${local.note}` : local.note;
    }
  }

  return { questions: questions.slice(0, count), usedAi, note };
}
