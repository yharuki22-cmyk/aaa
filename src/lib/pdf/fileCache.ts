"use client";

// セッション中に元のPDFファイルを保持し、ページプレビューに利用する。
// （ページ再読み込み後はクリアされる。解析結果・履歴はIndexedDBに残る。）

const cache = new Map<string, File>();

export function cacheFile(pdfName: string, file: File) {
  cache.set(pdfName, file);
}

export function getCachedFile(pdfName: string): File | undefined {
  return cache.get(pdfName);
}

export function hasCachedFile(pdfName: string): boolean {
  return cache.has(pdfName);
}
