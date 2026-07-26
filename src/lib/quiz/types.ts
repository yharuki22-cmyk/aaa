// アプリ全体で共有する型定義

/** PDFから抽出した1つのセグメント（原文の一部）。問題の根拠になる。 */
export interface ExtractedSegment {
  /** 一意なID */
  id: string;
  /** 由来PDFのファイル名 */
  pdfName: string;
  /** ページ番号（1始まり） */
  page: number;
  /** 抽出した原文テキスト */
  text: string;
  /** この抽出の由来 */
  source: "highlight" | "underline-image" | "ocr" | "fulltext";
  /**
   * 線引き/ハイライト由来かどうか（問題化の優先度が高い）。
   * highlight / underline-image は true。
   */
  emphasized: boolean;
}

/** 1つのPDFの解析結果 */
export interface PdfAnalysis {
  pdfName: string;
  pageCount: number;
  segments: ExtractedSegment[];
  /** 線引き箇所を検出できたか。false の場合は全文からの代替抽出を行った。 */
  hasEmphasis: boolean;
  /** 解析に用いた主な手段 */
  methods: Array<"highlight" | "underline-image" | "ocr" | "fulltext">;
  /** 画面表示用の注意メッセージ（代替処理を行った旨など） */
  notes: string[];
}

/** 4択の選択肢ラベル */
export type ChoiceLabel = "A" | "B" | "C" | "D";

/** 生成された1問 */
export interface QuizQuestion {
  /** 問題識別用ハッシュ（重複検出に使用） */
  hash: string;
  /** 問題文 */
  question: string;
  /** 4つの選択肢（index 0=A, 1=B, 2=C, 3=D） */
  choices: [string, string, string, string];
  /** 正解の番号（0-3） */
  correctIndex: number;
  /** 日本語の解説（なぜその答えになるのか） */
  explanation: string;
  /** 各誤答が誤りである理由（正解以外の選択肢について） */
  distractorReasons: string[];
  /** 出典PDF名 */
  sourcePdf: string;
  /** 出典ページ番号 */
  sourcePage: number;
  /** 根拠となった原文の短い抜粋 */
  sourceQuote: string;
  /** 問題形式のタイプ（分野別集計にも利用） */
  category: QuestionCategory;
  /** 生成手段 */
  generatedBy: "local" | "ai";
}

export type QuestionCategory =
  | "term" // 用語
  | "feature" // 特徴・性質
  | "use" // 用途
  | "material" // 原材料
  | "process" // 製造方法・施工
  | "number" // 数値・単位
  | "comparison" // 材料比較
  | "understanding"; // 理解確認

/** 1問に対する回答記録 */
export interface AnswerRecord {
  hash: string;
  question: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  sourcePdf: string;
  sourcePage: number;
  category: QuestionCategory;
  answeredAt: number;
}

/** 学習履歴の集計 */
export interface HistoryStats {
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number; // 0-1
  byPdf: Record<string, { answered: number; correct: number }>;
  byCategory: Record<string, { answered: number; correct: number }>;
}
