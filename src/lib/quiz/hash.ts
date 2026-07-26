/**
 * 問題の同一性を判定するためのハッシュ。
 * 「選択肢の順番を変えただけ」を同一問題とみなすため、
 * 問題文 + 正解テキスト + 選択肢の集合(ソート済み) からハッシュを作る。
 */

/** 日本語テキストの正規化（空白・記号の揺れを吸収） */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[、。，．,.　]/g, "")
    .toLowerCase()
    .trim();
}

/** 決定的な文字列ハッシュ（FNV-1a 32bit を16進で返す） */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 符号なし32bitに整える
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * 問題の内容ハッシュ。
 * 選択肢はソートしてから連結するため、順番だけが違う問題は同じハッシュになる。
 */
export function computeQuestionHash(params: {
  question: string;
  choices: string[];
  correctText: string;
}): string {
  const q = normalizeText(params.question);
  const correct = normalizeText(params.correctText);
  const sortedChoices = params.choices
    .map((c) => normalizeText(c))
    .sort()
    .join("|");
  return fnv1a(`${q}#${correct}#${sortedChoices}`);
}
