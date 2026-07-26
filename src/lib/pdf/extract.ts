// PDFからのテキスト・線引き抽出のメイン処理（ブラウザ内で実行）。
// 優先度: 注釈ハイライト/下線 → 画像埋め込みの蛍光ペン検出 → OCR → 全文からの重要文抽出。

"use client";

import type { ExtractedSegment, PdfAnalysis } from "../quiz/types";
import { detectHighlightBands } from "./highlightImage";
import { ocrCanvas } from "./ocr";

export interface ProcessProgress {
  pdfName: string;
  page: number;
  totalPages: number;
  stage: string;
  percent: number;
}

export type ProgressCallback = (p: ProcessProgress) => void;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let pdfjsLibCache: any = null;
async function getPdfjs() {
  if (!pdfjsLibCache) {
    const pdfjs = await import("pdfjs-dist");
    // public/ にコピーしたワーカーを利用（オフライン動作）
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    pdfjsLibCache = pdfjs;
  }
  return pdfjsLibCache;
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x0: Math.min(x1, x2),
    y0: Math.min(y1, y2),
    x1: Math.max(x1, x2),
    y1: Math.max(y1, y2),
  };
}

/** 注釈からハイライト対象の矩形群を取り出す */
function rectsFromAnnotation(annot: any): Rect[] {
  const rects: Rect[] = [];
  const qp = annot.quadPoints;
  if (qp) {
    // pdfjs のバージョンにより形式が異なるため両対応
    if (Array.isArray(qp) && qp.length > 0 && typeof qp[0] === "object") {
      // [{x,y}, {x,y}, ...] 4点ずつ
      for (let i = 0; i + 3 < qp.length; i += 4) {
        const xs = [qp[i].x, qp[i + 1].x, qp[i + 2].x, qp[i + 3].x];
        const ys = [qp[i].y, qp[i + 1].y, qp[i + 2].y, qp[i + 3].y];
        rects.push(
          normalizeRect(
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs),
            Math.max(...ys)
          )
        );
      }
    } else if (typeof qp[0] === "number") {
      // [x1,y1,x2,y2,...] 8個ずつ
      for (let i = 0; i + 7 < qp.length; i += 8) {
        const xs = [qp[i], qp[i + 2], qp[i + 4], qp[i + 6]];
        const ys = [qp[i + 1], qp[i + 3], qp[i + 5], qp[i + 7]];
        rects.push(
          normalizeRect(
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs),
            Math.max(...ys)
          )
        );
      }
    }
  }
  if (rects.length === 0 && Array.isArray(annot.rect) && annot.rect.length === 4) {
    rects.push(
      normalizeRect(annot.rect[0], annot.rect[1], annot.rect[2], annot.rect[3])
    );
  }
  return rects;
}

interface TextItemBox {
  str: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
}

function itemsToBoxes(items: any[]): TextItemBox[] {
  const boxes: TextItemBox[] = [];
  for (const it of items) {
    if (!it || typeof it.str !== "string" || it.str.trim() === "") continue;
    const t = it.transform;
    if (!t) continue;
    const x = t[4];
    const y = t[5];
    const w = it.width ?? 0;
    const h = it.height ?? 8;
    boxes.push({
      str: it.str,
      x0: x,
      y0: y,
      x1: x + w,
      y1: y + h,
      cx: x + w / 2,
      cy: y + h / 2,
    });
  }
  return boxes;
}

function centerInRect(box: TextItemBox, r: Rect): boolean {
  return box.cx >= r.x0 && box.cx <= r.x1 && box.cy >= r.y0 && box.cy <= r.y1;
}

/** 矩形群に重なるテキストを連結して返す */
function collectTextInRects(boxes: TextItemBox[], rects: Rect[]): string {
  if (rects.length === 0) return "";
  const selected = boxes.filter((b) => rects.some((r) => centerInRect(b, r)));
  return selected
    .map((b) => b.str)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** 全文から「重要そうな」文を抽出（線引きが無い場合の代替） */
function extractImportantSentences(
  text: string,
  max: number
): string[] {
  const sentences = text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10 && s.length <= 140);

  const KEYWORDS =
    /コンクリート|モルタル|セメント|鋼|鉄筋|木材|合板|ガラス|タイル|れんが|石膏|せっこう|アスファルト|骨材|強度|耐火|耐久|density|密度|吸水|熱|規格|JIS|養生|施工|性質|特徴|用途|材料/;

  const scored = sentences.map((s) => {
    let score = 0;
    if (KEYWORDS.test(s)) score += 3;
    if (/\d/.test(s)) score += 1;
    if (s.length >= 25 && s.length <= 90) score += 1;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { s } of scored) {
    const key = s.replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

let segCounter = 0;
function nextId() {
  segCounter += 1;
  return `seg-${Date.now().toString(36)}-${segCounter}`;
}

/**
 * 1つのPDFを解析して PdfAnalysis を返す。
 */
export async function processPdf(
  file: File,
  pdfName: string,
  onProgress?: ProgressCallback
): Promise<PdfAnalysis> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();

  onProgress?.({
    pdfName,
    page: 0,
    totalPages: 0,
    stage: "PDFを読み込み中",
    percent: 2,
  });

  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const totalPages: number = doc.numPages;

  const emphasized: ExtractedSegment[] = [];
  const fulltextSegments: ExtractedSegment[] = [];
  const methods = new Set<PdfAnalysis["methods"][number]>();
  const notes: string[] = [];
  let ocrPagesUsed = 0;
  const MAX_OCR_PAGES = 25;

  for (let p = 1; p <= totalPages; p++) {
    const page = await doc.getPage(p);
    const percentBase = 5 + Math.floor((p / totalPages) * 90);
    onProgress?.({
      pdfName,
      page: p,
      totalPages,
      stage: `ページ ${p}/${totalPages} を解析中`,
      percent: percentBase,
    });

    const textContent = await page.getTextContent();
    const boxes = itemsToBoxes(textContent.items as any[]);
    const fullPageText = boxes
      .map((b) => b.str)
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    // 1) 注釈ハイライト/下線
    let pageHasAnnotHighlight = false;
    try {
      const annots = (await page.getAnnotations()) as any[];
      const hi = annots.filter(
        (a) => a.subtype === "Highlight" || a.subtype === "Underline"
      );
      for (const a of hi) {
        const rects = rectsFromAnnotation(a);
        const text = collectTextInRects(boxes, rects);
        // 注釈自体のテキスト(contents)も併用
        const content = (a.contents ?? "").toString().trim();
        const finalText = text || content;
        if (finalText && finalText.length >= 2) {
          emphasized.push({
            id: nextId(),
            pdfName,
            page: p,
            text: finalText,
            source: "highlight",
            emphasized: true,
          });
          pageHasAnnotHighlight = true;
          methods.add("highlight");
        }
      }
    } catch {
      // 注釈が取得できない場合は無視して次へ
    }

    // OCRが必要かどうか（テキスト層がほぼ無い＝スキャンPDF）
    const needsOcr = fullPageText.length < 20;

    // 2) 画像埋め込みの蛍光ペン検出（注釈が無い、かつテキスト層がある場合）
    //    または OCR（テキスト層が無い場合）のためにページを描画
    if ((!pageHasAnnotHighlight && !needsOcr) || needsOcr) {
      try {
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;

          if (!pageHasAnnotHighlight && !needsOcr) {
            // 画像から蛍光ペンの帯を検出
            onProgress?.({
              pdfName,
              page: p,
              totalPages,
              stage: `ページ ${p}: 画像から線引きを検出中`,
              percent: percentBase,
            });
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const bands = detectHighlightBands(
              imageData,
              canvas.width,
              canvas.height,
              (cy) => viewport.convertToPdfPoint(0, cy)[1]
            );
            for (const band of bands) {
              const rect: Rect = {
                x0: -Infinity,
                x1: Infinity,
                y0: band.yMinPdf,
                y1: band.yMaxPdf,
              };
              const text = collectTextInRects(boxes, [rect]);
              if (text && text.length >= 4) {
                emphasized.push({
                  id: nextId(),
                  pdfName,
                  page: p,
                  text,
                  source: "underline-image",
                  emphasized: true,
                });
                methods.add("underline-image");
              }
            }
          }

          if (needsOcr && ocrPagesUsed < MAX_OCR_PAGES) {
            onProgress?.({
              pdfName,
              page: p,
              totalPages,
              stage: `ページ ${p}: OCR実行中（時間がかかる場合があります）`,
              percent: percentBase,
            });
            const ocrText = await ocrCanvas(canvas);
            ocrPagesUsed++;
            if (ocrText && ocrText.length > 10) {
              methods.add("ocr");
              for (const s of extractImportantSentences(ocrText, 8)) {
                fulltextSegments.push({
                  id: nextId(),
                  pdfName,
                  page: p,
                  text: s,
                  source: "ocr",
                  emphasized: false,
                });
              }
            }
          }
        }
      } catch {
        // 描画/OCR失敗は致命的でないため無視
      }
    }

    // 3) 全文からの重要文（プールを豊かにするため常に一定数保持）
    if (fullPageText.length >= 20) {
      methods.add("fulltext");
      for (const s of extractImportantSentences(fullPageText, 6)) {
        fulltextSegments.push({
          id: nextId(),
          pdfName,
          page: p,
          text: s,
          source: "fulltext",
          emphasized: false,
        });
      }
    }
  }

  const hasEmphasis = emphasized.length > 0;
  if (!hasEmphasis) {
    notes.push(
      "このPDFでは線引き・ハイライト箇所を検出できませんでした。PDF全体から重要事項を抽出して問題を作成します。"
    );
  } else {
    notes.push(
      `線引き/ハイライト箇所を ${emphasized.length} 件検出しました。これらを優先的に問題化します。`
    );
  }

  onProgress?.({
    pdfName,
    page: totalPages,
    totalPages,
    stage: "解析完了",
    percent: 100,
  });

  // 線引きを優先しつつ、全文からの補助セグメントも含める
  const segments = [...emphasized, ...fulltextSegments];

  return {
    pdfName,
    pageCount: totalPages,
    segments,
    hasEmphasis,
    methods: Array.from(methods),
    notes,
  };
}
