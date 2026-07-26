// APIキー不要で動作する「ローカル簡易問題生成」。
// PDFの原文だけを唯一の根拠とし、原文中の語句を空欄化する方式で
// 「正解が必ず原文に存在する」ことを構造的に保証する。
// これにより「PDFにない事実を根拠にしない」という要件を満たす。

import type {
  ExtractedSegment,
  QuizQuestion,
  QuestionCategory,
} from "./types";
import { computeQuestionHash, normalizeText } from "./hash";

// ---- 乱数（テストのため注入可能な決定的RNGに対応） ----
export type Rng = () => number;

/** mulberry32: シード可能な決定的乱数生成器 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 建築材料学でよく使われる材料名（正誤の根拠には使わず、語の分類にのみ利用） ----
const MATERIAL_NAMES = [
  "コンクリート",
  "モルタル",
  "セメント",
  "鋼材",
  "鉄筋",
  "鉄骨",
  "木材",
  "合板",
  "集成材",
  "ガラス",
  "アルミニウム",
  "ステンレス",
  "タイル",
  "れんが",
  "石膏",
  "せっこう",
  "石こうボード",
  "アスファルト",
  "塩化ビニル",
  "花崗岩",
  "大理石",
  "断熱材",
  "骨材",
  "砂利",
  "石灰",
  "陶磁器",
  "プラスチック",
  "ゴム",
  "塗料",
  "接着剤",
  "防水材",
  "シーリング材",
  "ALC",
  "PC鋼材",
];

// 数値に付く単位
const UNITS = [
  "mm",
  "cm",
  "km",
  "kg",
  "kN",
  "MPa",
  "N/mm2",
  "N/mm²",
  "N",
  "kW",
  "W",
  "℃",
  "°C",
  "%",
  "パーセント",
  "倍",
  "時間",
  "日",
  "年",
  "m",
  "g",
  "t",
];

const NUMBER_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*(${UNITS.map((u) =>
    u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")})`,
  "g"
);
const KATAKANA_RE = /[ァ-ヴ][ァ-ヴー]{2,}/g;
const KANJI_RE = /[一-龥]{2,}/g;

const MIN_SENTENCE_LEN = 10;
const MAX_SENTENCE_LEN = 140;

type TokenType = "number" | "material" | "katakana" | "kanji";
interface Token {
  text: string;
  type: TokenType;
}

interface SentenceCandidate {
  segment: ExtractedSegment;
  sentence: string;
}

/** セグメントを文に分割し、問題化に適した候補文を作る（線引き優先） */
export function buildSentenceCandidates(
  segments: ExtractedSegment[]
): SentenceCandidate[] {
  // 線引き/ハイライト由来を優先的に前に並べる
  const ordered = [...segments].sort(
    (a, b) => Number(b.emphasized) - Number(a.emphasized)
  );
  const seen = new Set<string>();
  const out: SentenceCandidate[] = [];
  for (const seg of ordered) {
    const sentences = seg.text
      .split(/[。！？\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of sentences) {
      if (s.length < MIN_SENTENCE_LEN || s.length > MAX_SENTENCE_LEN) continue;
      const key = normalizeText(s);
      if (key.length < 8 || seen.has(key)) continue;
      seen.add(key);
      out.push({ segment: seg, sentence: s });
    }
  }
  return out;
}

/** 文から抽出できる語句トークンを列挙 */
function extractTokens(sentence: string): Token[] {
  const tokens: Token[] = [];
  const numMatches = sentence.match(NUMBER_RE) ?? [];
  for (const m of numMatches) tokens.push({ text: m.trim(), type: "number" });
  for (const name of MATERIAL_NAMES) {
    if (sentence.includes(name)) tokens.push({ text: name, type: "material" });
  }
  const kata = sentence.match(KATAKANA_RE) ?? [];
  for (const k of kata) {
    if (!MATERIAL_NAMES.includes(k)) tokens.push({ text: k, type: "katakana" });
  }
  const kanji = sentence.match(KANJI_RE) ?? [];
  for (const k of kanji) {
    if (k.length >= 2 && k.length <= 8)
      tokens.push({ text: k, type: "kanji" });
  }
  return tokens;
}

/** 文の中で最も「問題化に向いた」1トークンを選ぶ（優先度: 数値 > 材料 > カタカナ > 漢字） */
function pickSalientToken(sentence: string): Token | null {
  const tokens = extractTokens(sentence);
  if (tokens.length === 0) return null;
  const priority: TokenType[] = ["number", "material", "katakana", "kanji"];
  for (const type of priority) {
    const ofType = tokens
      .filter((t) => t.type === type)
      .sort((a, b) => b.text.length - a.text.length);
    if (ofType.length > 0) return ofType[0];
  }
  return null;
}

/** コーパス全体からタイプ別の語句プールを作る（誤答選択肢の材料に使う） */
function buildTokenPools(candidates: SentenceCandidate[]) {
  const pools: Record<TokenType, Set<string>> = {
    number: new Set(),
    material: new Set(),
    katakana: new Set(),
    kanji: new Set(),
  };
  for (const c of candidates) {
    for (const t of extractTokens(c.sentence)) pools[t.type].add(t.text);
  }
  return pools;
}

/** 数値文字列を分解 */
function parseNumber(token: string): { value: number; unit: string } | null {
  const m = token.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: m[2].trim() };
}

/** 数値の誤答を機械的に生成（単位はそのまま、値だけ変える） */
function makeNumericDistractors(
  correct: string,
  pool: Set<string>,
  rng: Rng
): string[] {
  const parsed = parseNumber(correct);
  const result: string[] = [];
  const usedNorm = new Set<string>([normalizeText(correct)]);

  // まず同じ単位のプールから探す
  if (parsed) {
    for (const p of pool) {
      const pp = parseNumber(p);
      if (pp && pp.unit === parsed.unit && pp.value !== parsed.value) {
        const norm = normalizeText(p);
        if (!usedNorm.has(norm)) {
          usedNorm.add(norm);
          result.push(p);
        }
      }
      if (result.length >= 3) break;
    }
  }

  // 足りなければ値を変形して補う
  if (parsed) {
    const factors = [0.5, 2, 1.5, 0.25, 3, 0.75, 4, 10];
    for (const f of factors) {
      if (result.length >= 3) break;
      let v = parsed.value * f;
      // 整数っぽい元値なら整数に丸める
      if (Number.isInteger(parsed.value)) v = Math.round(v);
      else v = Math.round(v * 10) / 10;
      if (v === parsed.value || v <= 0) continue;
      const cand = `${v}${parsed.unit}`;
      const norm = normalizeText(cand);
      if (!usedNorm.has(norm)) {
        usedNorm.add(norm);
        result.push(cand);
      }
    }
  }
  return shuffle(result, rng).slice(0, 3);
}

/** 語句の誤答をプールから選ぶ */
function makeTermDistractors(
  correct: string,
  type: TokenType,
  pools: Record<TokenType, Set<string>>,
  sentence: string,
  rng: Rng
): string[] {
  const correctNorm = normalizeText(correct);
  const usedNorm = new Set<string>([correctNorm]);
  const collect = (set: Set<string>) =>
    shuffle([...set], rng).filter((cand) => {
      const norm = normalizeText(cand);
      if (usedNorm.has(norm)) return false;
      // 同じ文中に既に出てくる語は誤答にしない（文脈的に混乱するため）
      if (sentence.includes(cand)) return false;
      // 長さが極端に違う語は避ける（正解だけ長い等を防ぐ）
      if (Math.abs(cand.length - correct.length) > Math.max(4, correct.length))
        return false;
      usedNorm.add(norm);
      return true;
    });

  let pool = collect(pools[type]);
  // 材料が足りなければ静的な材料名リストで補完
  if (type === "material" && pool.length < 3) {
    const extra = shuffle(MATERIAL_NAMES, rng).filter((m) => {
      const norm = normalizeText(m);
      if (usedNorm.has(norm) || sentence.includes(m)) return false;
      usedNorm.add(norm);
      return true;
    });
    pool = pool.concat(extra);
  }
  // それでも足りなければ他タイプの語も混ぜる
  if (pool.length < 3) {
    for (const other of ["material", "kanji", "katakana"] as TokenType[]) {
      if (other === type) continue;
      pool = pool.concat(collect(pools[other]));
      if (pool.length >= 3) break;
    }
  }
  return pool.slice(0, 3);
}

/** 文とトークンからカテゴリ（問題形式）を推定 */
function inferCategory(sentence: string, type: TokenType): QuestionCategory {
  if (type === "number") return "number";
  if (/より|に比べ|に比べて|比較|以上|以下|高い|低い|大きい|小さい/.test(sentence))
    return "comparison";
  if (/用途|用いら|用いる|使わ|使用|適し|向い/.test(sentence)) return "use";
  if (/製造|焼成|養生|施工|混合|混ぜ|練り|成形|乾燥|硬化/.test(sentence))
    return "process";
  if (/特徴|性質|性能|強度|耐|密度|吸水|熱|膨張|収縮|比重/.test(sentence))
    return "feature";
  if (type === "material") return "material";
  return "term";
}

const CATEGORY_STEM: Record<QuestionCategory, string> = {
  number: "次の説明の空欄【　】に当てはまる最も適切な数値を選びなさい。",
  material: "次の説明の空欄【　】に当てはまる最も適切な材料・語句を選びなさい。",
  use: "次の説明の空欄【　】に当てはまる最も適切な語句を選びなさい（用途に関する問題）。",
  process:
    "次の説明の空欄【　】に当てはまる最も適切な語句を選びなさい（製造・施工に関する問題）。",
  feature:
    "次の説明の空欄【　】に当てはまる最も適切な語句を選びなさい（特徴・性質に関する問題）。",
  comparison:
    "次の説明の空欄【　】に当てはまる最も適切な語句を選びなさい（比較に関する問題）。",
  term: "次の説明の空欄【　】に当てはまる最も適切な語句を選びなさい。",
  understanding:
    "次の説明の空欄【　】に当てはまる最も適切な語句を選びなさい。",
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export interface GenerateOptions {
  count?: number;
  excludeHashes?: Set<string>;
  rng?: Rng;
}

export interface GenerateResult {
  questions: QuizQuestion[];
  /** 要求数に満たなかった場合など、画面表示用のメッセージ */
  note?: string;
}

/**
 * ローカル生成のメイン関数。
 * 原文中の語句を空欄化し、コーパス内の他語句を誤答として4択問題を作る。
 */
export function generateLocalQuestions(
  segments: ExtractedSegment[],
  options: GenerateOptions = {}
): GenerateResult {
  const count = options.count ?? 10;
  const exclude = options.excludeHashes ?? new Set<string>();
  const rng = options.rng ?? Math.random;

  const candidates = shuffle(buildSentenceCandidates(segments), rng);
  const pools = buildTokenPools(candidates);

  interface Prepared {
    question: string;
    correct: string;
    distractors: string[];
    explanation: string;
    distractorReasons: string[];
    sourcePdf: string;
    sourcePage: number;
    sourceQuote: string;
    category: QuestionCategory;
    baseHash: string;
  }

  const prepared: Prepared[] = [];
  const usedHash = new Set<string>();

  for (const cand of candidates) {
    if (prepared.length >= count) break;
    const token = pickSalientToken(cand.sentence);
    if (!token) continue;

    const distractors =
      token.type === "number"
        ? makeNumericDistractors(token.text, pools.number, rng)
        : makeTermDistractors(token.text, token.type, pools, cand.sentence, rng);

    if (distractors.length < 3) continue; // 良質な誤答が作れない設問は破棄

    const category = inferCategory(cand.sentence, token.type);
    // 空欄化した問題文
    const blanked = cand.sentence.replace(token.text, "【　】");
    if (!blanked.includes("【　】")) continue;

    const quote = truncate(cand.sentence, 60);
    const isNum = token.type === "number";
    const distractorReasons = distractors.map((d) =>
      isNum
        ? `「${d}」はPDFの該当箇所に記載された数値と一致しません。`
        : `「${d}」はPDF内の別の箇所に現れる語で、この記述の空欄には該当しません。`
    );
    const explanation = `PDFの原文「${quote}」より、空欄には「${token.text}」が入ります。（出典: ${cand.segment.pdfName} p.${cand.segment.page}）`;

    // 「選択肢の順番を変えただけ」を同一視するためのハッシュ
    const baseHash = computeQuestionHash({
      question: blanked,
      choices: [token.text, ...distractors],
      correctText: token.text,
    });
    if (exclude.has(baseHash) || usedHash.has(baseHash)) continue;
    usedHash.add(baseHash);

    prepared.push({
      question: `${CATEGORY_STEM[category]}\n『${blanked}』`,
      correct: token.text,
      distractors,
      explanation,
      distractorReasons,
      sourcePdf: cand.segment.pdfName,
      sourcePage: cand.segment.page,
      sourceQuote: quote,
      category,
      baseHash,
    });
  }

  // 正解位置がA〜Dに偏らないよう、均等な割り当てをシャッフルして配る
  const positions = shuffle(
    prepared.map((_, i) => i % 4),
    rng
  );

  const questions: QuizQuestion[] = prepared.map((p, i) => {
    const correctIndex = positions[i];
    const choices: string[] = [...p.distractors];
    choices.splice(correctIndex, 0, p.correct);
    // 念のため4つに調整
    const finalChoices = choices.slice(0, 4) as [
      string,
      string,
      string,
      string,
    ];
    // 誤答理由を選択肢順（正解を除く）に対応させる
    const reasonsInOrder: string[] = [];
    let di = 0;
    for (let idx = 0; idx < 4; idx++) {
      if (idx === correctIndex) continue;
      reasonsInOrder.push(p.distractorReasons[di] ?? "PDFの記載に該当しません。");
      di++;
    }
    return {
      hash: p.baseHash,
      question: p.question,
      choices: finalChoices,
      correctIndex,
      explanation: p.explanation,
      distractorReasons: reasonsInOrder,
      sourcePdf: p.sourcePdf,
      sourcePage: p.sourcePage,
      sourceQuote: p.sourceQuote,
      category: p.category,
      generatedBy: "local" as const,
    };
  });

  let note: string | undefined;
  if (questions.length < count) {
    note =
      questions.length === 0
        ? "問題を作成できる十分な題材がPDFから見つかりませんでした。線引き箇所を増やすか、別のPDFを追加してください。"
        : `題材が不足しているため、${questions.length}問のみ生成しました（重複を避けるため要求数に達していません）。`;
  }

  return { questions, note };
}
