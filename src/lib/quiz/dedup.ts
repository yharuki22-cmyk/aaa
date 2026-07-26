// 出題の重複排除。直近に出した問題（ハッシュ）と重ならないようにする。

import type { QuizQuestion } from "./types";

/** exclude に含まれるハッシュの問題を取り除く */
export function filterDuplicates(
  questions: QuizQuestion[],
  excludeHashes: Set<string>
): QuizQuestion[] {
  const seen = new Set<string>(excludeHashes);
  const out: QuizQuestion[] = [];
  for (const q of questions) {
    if (seen.has(q.hash)) continue;
    seen.add(q.hash);
    out.push(q);
  }
  return out;
}

/** 2つの問題セットに重複ハッシュが無いか判定 */
export function hasOverlap(a: QuizQuestion[], b: QuizQuestion[]): boolean {
  const set = new Set(a.map((q) => q.hash));
  return b.some((q) => set.has(q.hash));
}
