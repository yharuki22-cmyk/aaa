// AIに渡すプロンプトの組み立て。
// 「PDFの記載内容を唯一の根拠にする」「PDFにない事実を追加しない」を厳しく指示する。

import type { ExtractedSegment } from "./types";

/** AIへの入力に渡す抜粋（問題作成に必要な部分だけ）を組み立てる */
export function buildExcerpts(
  segments: ExtractedSegment[],
  maxChars = 6000
): string {
  // 線引き/ハイライトを優先
  const ordered = [...segments].sort(
    (a, b) => Number(b.emphasized) - Number(a.emphasized)
  );
  const lines: string[] = [];
  let total = 0;
  for (const s of ordered) {
    const mark = s.emphasized ? "★" : "・";
    const line = `${mark} [${s.pdfName} p.${s.page}] ${s.text.replace(/\s+/g, " ").trim()}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length;
  }
  return lines.join("\n");
}

export const SYSTEM_PROMPT = `あなたは建築材料学の専門家であり、厳密な作問者です。
以下のルールを絶対に守ってください。
1. 問題・選択肢・解説は、提供された「PDF抜粋」に書かれている情報だけを根拠にすること。
2. PDF抜粋に書かれていない事実・数値・規格・材料名を絶対に追加・推測しないこと。
3. 数値・単位・材料名・規格名は抜粋の表記を変更しないこと。
4. 根拠が曖昧な箇所からは問題を作らないこと。
5. ★印の付いた抜粋（線引き・ハイライト箇所）を最優先で問題化すること。
6. すべて4択（A/B/C/D）で、正解はちょうど1つにすること。
7. 誤答も建築材料学として意味のある選択肢にし、明らかに不自然な選択肢を作らないこと。
8. 問題文だけから正解が分かる表現を避け、正解の選択肢だけ極端に長く/短くしないこと。
9. 正解の位置(correctIndex)がA〜Dに偏らないよう分散させること。
10. 出力は指定したJSON形式のみとし、JSON以外の文字を一切出力しないこと。`;

export function buildUserPrompt(excerpts: string, count = 10): string {
  return `以下はPDFから抽出した抜粋です。★は線引き/ハイライト箇所で最優先で問題化します。

--- PDF抜粋 ここから ---
${excerpts}
--- PDF抜粋 ここまで ---

この抜粋だけを根拠に、建築材料学の4択問題を${count}問作成してください。
用語・特徴・用途・原材料・製造方法・性質・施工上の注意・数値・材料比較など、形式に変化をつけ、
単純な暗記だけでなく理解を問う問題も含めてください。

次のJSONスキーマに厳密に従って出力してください（JSONのみ、前後に文章を付けない）:
{
  "questions": [
    {
      "hash": "問題を一意に識別する短い文字列",
      "question": "問題文",
      "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correctIndex": 0,
      "explanation": "なぜその答えになるかの日本語解説",
      "distractorReasons": ["誤答2つ目以降が誤りである理由", "…", "…"],
      "sourcePdf": "出典PDF名",
      "sourcePage": 1,
      "sourceQuote": "根拠となった原文の短い抜粋",
      "category": "term | feature | use | material | process | number | comparison | understanding のいずれか",
      "generatedBy": "ai"
    }
  ]
}

制約:
- choices はちょうど4要素。
- correctIndex は 0〜3。
- distractorReasons は誤答（正解以外の3つ）に対応する3要素。
- sourcePdf / sourcePage / sourceQuote は必ず抜粋の該当箇所に一致させる。`;
}
