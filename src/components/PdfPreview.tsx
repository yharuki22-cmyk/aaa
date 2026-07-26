"use client";

import { useEffect, useRef, useState } from "react";
import { getCachedFile } from "@/lib/pdf/fileCache";

let pdfjsCache: any = null;
async function getPdfjs() {
  if (!pdfjsCache) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    pdfjsCache = pdfjs;
  }
  return pdfjsCache;
}

/** 出典PDFの該当ページを描画して確認できるプレビュー */
export function PdfPreview({
  pdfName,
  page,
}: {
  pdfName: string;
  page: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const file = getCachedFile(pdfName);
      if (!file) {
        setStatus("unavailable");
        return;
      }
      try {
        const pdfjs = await getPdfjs();
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const target = Math.min(Math.max(1, page), doc.numPages);
        const pg = await doc.getPage(target);
        const scale = 1.2;
        const viewport = pg.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pg.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus("ok");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfName, page]);

  if (status === "unavailable") {
    return (
      <p className="text-sm text-base-muted">
        プレビューは、このセッションでアップロードしたPDFでのみ表示できます。
        （ページ再読み込み後は、同じPDFを再アップロードすると表示されます）
      </p>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded border border-base-line bg-white p-2">
      {status === "loading" && (
        <p className="text-sm text-base-muted">プレビューを読み込み中…</p>
      )}
      <canvas ref={canvasRef} className="mx-auto block max-w-full" />
    </div>
  );
}
