// OCR フォールバック（文字情報が無いスキャンPDF向け）。
// tesseract.js を用いて日本語+英語を認識する。
// 注意: 初回実行時に言語データ(jpn/eng)をダウンロードするためネットワークが必要。

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      // 日本語+英語。初回のみ言語データを取得。
      const worker = await createWorker(["jpn", "eng"]);
      return worker;
    })();
  }
  return workerPromise;
}

/** Canvas 画像からテキストを認識する */
export async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return (text ?? "").replace(/\s+\n/g, "\n").trim();
}

/** 使い終わったワーカーを解放（任意） */
export async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
