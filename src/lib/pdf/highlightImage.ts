// 画像として埋め込まれた蛍光ペン/下線を「可能な範囲で」検出する。
// ページを描画したCanvasのピクセルを走査し、蛍光ペン色（黄・緑・桃・橙など）が
// 多く含まれる横帯(row band)を特定して、そのY範囲を返す。

export interface HighlightBand {
  /** PDF座標系でのYの下端・上端（viewportで変換して返す） */
  yMinPdf: number;
  yMaxPdf: number;
}

/** ピクセルが蛍光ペンらしい色か判定（HSVベース） */
function isHighlighterPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  // 明るく、彩度がそこそこ高い＝蛍光ペンの特徴
  if (v < 0.5 || v > 0.98) return false;
  if (s < 0.25) return false; // 無彩色（黒文字・グレー）は除外
  // 色相を求める
  let h = 0;
  if (max === min) h = 0;
  else if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
  else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
  else h = 60 * ((r - g) / (max - min)) + 240;
  // 黄(45-70) 緑(70-160) 桃/マゼンタ(280-330) 橙(20-45) を蛍光ペン候補とする
  return (
    (h >= 20 && h <= 170) || (h >= 280 && h <= 340)
  );
}

/**
 * ImageData から蛍光ペンの横帯を検出する。
 * @param imageData 描画済みページの画素
 * @param width canvas幅
 * @param height canvas高さ
 * @param toPdfY canvasのy(px)をPDF座標のyに変換する関数
 */
export function detectHighlightBands(
  imageData: ImageData,
  width: number,
  height: number,
  toPdfY: (canvasY: number) => number
): HighlightBand[] {
  const data = imageData.data;
  const rowCounts = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = base + x * 4;
      if (isHighlighterPixel(data[i], data[i + 1], data[i + 2])) count++;
    }
    rowCounts[y] = count;
  }
  // 1行の何割が着色されていれば「帯」とみなすか
  const threshold = Math.max(8, Math.floor(width * 0.05));

  const bands: HighlightBand[] = [];
  let start = -1;
  for (let y = 0; y < height; y++) {
    const on = rowCounts[y] >= threshold;
    if (on && start === -1) start = y;
    if ((!on || y === height - 1) && start !== -1) {
      const end = !on ? y - 1 : y;
      // 極端に細い帯（ノイズ）は無視
      if (end - start >= 3) {
        const yTop = toPdfY(start);
        const yBottom = toPdfY(end);
        bands.push({
          yMinPdf: Math.min(yTop, yBottom),
          yMaxPdf: Math.max(yTop, yBottom),
        });
      }
      start = -1;
    }
  }
  return bands;
}
