import { describe, it, expect } from "vitest";
import {
  validatePdfFile,
  sanitizeFileName,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/pdf/fileValidation";

describe("ファイル検証", () => {
  it("正しいPDFファイルを受理すること", () => {
    const r = validatePdfFile({
      name: "materials.pdf",
      size: 1024,
      type: "application/pdf",
    });
    expect(r.ok).toBe(true);
  });

  it("PDF以外の拡張子を拒否すること", () => {
    const r = validatePdfFile({
      name: "note.txt",
      size: 1024,
      type: "text/plain",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("PDF");
  });

  it("拡張子がpdfでもMIMEが異なる場合は拒否すること", () => {
    const r = validatePdfFile({
      name: "fake.pdf",
      size: 1024,
      type: "application/x-msdownload",
    });
    expect(r.ok).toBe(false);
  });

  it("サイズ上限を超えるファイルを拒否すること", () => {
    const r = validatePdfFile({
      name: "big.pdf",
      size: MAX_FILE_SIZE_BYTES + 1,
      type: "application/pdf",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("上限");
  });

  it("空のファイルを拒否すること", () => {
    const r = validatePdfFile({ name: "empty.pdf", size: 0 });
    expect(r.ok).toBe(false);
  });

  it("ファイル名を安全化すること（パス区切り・危険文字を除去）", () => {
    expect(sanitizeFileName("../../etc/passwd.pdf")).not.toContain("/");
    expect(sanitizeFileName('a<b>c:"d.pdf')).not.toMatch(/[<>:"]/);
    expect(sanitizeFileName("")).toBe("document.pdf");
  });
});
