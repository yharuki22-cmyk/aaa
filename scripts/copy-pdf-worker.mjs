// pdfjs-dist のワーカーファイルを public/ にコピーする。
// これにより、どのバンドラ環境でも安定してワーカーを読み込める（オフライン動作）。
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");

const candidates = [
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.mjs",
];

try {
  const src = candidates.map((c) => join(root, c)).find((p) => existsSync(p));
  if (!src) {
    console.warn(
      "[copy-pdf-worker] pdfjs-dist のワーカーが見つかりませんでした。`npm install` 後に再実行されます。"
    );
    process.exit(0);
  }
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  const dest = join(publicDir, "pdf.worker.min.mjs");
  copyFileSync(src, dest);
  console.log("[copy-pdf-worker] コピー完了:", dest);
} catch (err) {
  console.warn("[copy-pdf-worker] コピーに失敗しましたが処理は継続します:", err?.message ?? err);
  process.exit(0);
}
