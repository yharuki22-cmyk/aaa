"use client";

import { useRef, useState } from "react";
import type { PdfAnalysis } from "@/lib/quiz/types";

export function PdfUploader({
  analyses,
  processing,
  aiConfigured,
  maxFileSizeLabel,
  onUpload,
  onRemove,
}: {
  analyses: PdfAnalysis[];
  processing: boolean;
  aiConfigured: boolean;
  maxFileSizeLabel: string;
  onUpload: (files: FileList | File[]) => void;
  onRemove: (pdfName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <section className="rounded-xl border border-base-line bg-base-surface p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-base-ink">
        1. PDFをアップロード
      </h2>

      {/* AI利用時の注意書き */}
      {aiConfigured ? (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ 現在、AIによる問題生成が有効です。問題作成のため、PDFから抽出した
          <strong>文章の一部（抜粋）が外部AIサービスへ送信されます</strong>
          。機密情報を含むPDFの利用にはご注意ください。
        </div>
      ) : (
        <div className="mb-3 rounded-md border border-base-line bg-base-bg p-3 text-sm text-base-muted">
          🔒 現在はローカル生成モードです。PDFの内容は外部へ送信されず、すべてブラウザ内で処理されます。
        </div>
      )}

      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragOver ? "border-brand bg-brand/5" : "border-base-line bg-base-bg"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
        }}
      >
        <p className="mb-2 text-sm text-base-muted">
          PDFファイルをここにドラッグ＆ドロップ、または
        </p>
        <button
          type="button"
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          ファイルを選択（複数可）
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-xs text-base-muted">
          PDFファイル(.pdf)のみ・1ファイル最大 {maxFileSizeLabel}
        </p>
      </div>

      {/* 解析済みPDF一覧 */}
      {analyses.length > 0 && (
        <ul className="mt-4 space-y-2">
          {analyses.map((a) => (
            <li
              key={a.pdfName}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-base-line bg-base-bg px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium text-base-ink">📄 {a.pdfName}</span>
                <span className="ml-2 text-xs text-base-muted">
                  {a.pageCount}ページ / 抽出 {a.segments.length}件
                </span>
                <div className="mt-0.5 text-xs">
                  {a.hasEmphasis ? (
                    <span className="text-correct">
                      ✔ 線引き/ハイライトを検出
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      ⚠ 線引き未検出：全文から重要事項を抽出しました
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(a.pdfName)}
                className="shrink-0 rounded border border-base-line px-2 py-1 text-xs text-base-muted hover:bg-white"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
