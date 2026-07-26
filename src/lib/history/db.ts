// IndexedDB を用いた永続化（解析結果・出題履歴・回答履歴）。
// リロードしても解析結果と学習履歴を維持する。

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AnswerRecord, PdfAnalysis, QuizQuestion } from "../quiz/types";

const DB_NAME = "kenchiku-quiz";
const DB_VERSION = 1;

interface QuizDB extends DBSchema {
  analyses: {
    key: string; // pdfName
    value: PdfAnalysis;
  };
  answers: {
    key: number; // auto increment
    value: AnswerRecord;
    indexes: { byHash: string; byTime: number };
  };
  // 出題済みの問題ハッシュ（重複回避用）
  askedHashes: {
    key: string; // hash
    value: { hash: string; askedAt: number };
  };
  // 生成済みの問題本体（復習モードで再取得するため）
  questions: {
    key: string; // hash
    value: QuizQuestion;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<QuizDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB はブラウザでのみ利用できます。");
  }
  if (!dbPromise) {
    dbPromise = openDB<QuizDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("analyses")) {
          db.createObjectStore("analyses", { keyPath: "pdfName" });
        }
        if (!db.objectStoreNames.contains("answers")) {
          const store = db.createObjectStore("answers", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("byHash", "hash");
          store.createIndex("byTime", "answeredAt");
        }
        if (!db.objectStoreNames.contains("askedHashes")) {
          db.createObjectStore("askedHashes", { keyPath: "hash" });
        }
        if (!db.objectStoreNames.contains("questions")) {
          db.createObjectStore("questions", { keyPath: "hash" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

// ---- 解析結果 ----
export async function saveAnalysis(analysis: PdfAnalysis) {
  const db = await getDB();
  await db.put("analyses", analysis);
}

export async function getAllAnalyses(): Promise<PdfAnalysis[]> {
  const db = await getDB();
  return db.getAll("analyses");
}

export async function deleteAnalysis(pdfName: string) {
  const db = await getDB();
  await db.delete("analyses", pdfName);
}

export async function clearAnalyses() {
  const db = await getDB();
  await db.clear("analyses");
}

// ---- 回答履歴 ----
export async function addAnswerRecords(records: AnswerRecord[]) {
  const db = await getDB();
  const tx = db.transaction("answers", "readwrite");
  for (const r of records) {
    // id を付けずに追加（autoIncrement）
    await tx.store.add(r as AnswerRecord & { id?: number });
  }
  await tx.done;
}

export async function getAllAnswers(): Promise<AnswerRecord[]> {
  const db = await getDB();
  return db.getAll("answers");
}

export async function clearAnswers() {
  const db = await getDB();
  await db.clear("answers");
}

// ---- 出題済みハッシュ ----
export async function addAskedHashes(hashes: string[]) {
  const db = await getDB();
  const tx = db.transaction("askedHashes", "readwrite");
  const now = Date.now();
  for (const h of hashes) {
    await tx.store.put({ hash: h, askedAt: now });
  }
  await tx.done;
}

export async function getAskedHashes(): Promise<Set<string>> {
  const db = await getDB();
  const all = await db.getAll("askedHashes");
  return new Set(all.map((a) => a.hash));
}

export async function clearAskedHashes() {
  const db = await getDB();
  await db.clear("askedHashes");
}

// ---- 生成済み問題本体 ----
export async function saveQuestions(questions: QuizQuestion[]) {
  const db = await getDB();
  const tx = db.transaction("questions", "readwrite");
  for (const q of questions) {
    await tx.store.put(q);
  }
  await tx.done;
}

export async function getQuestionsByHashes(
  hashes: string[]
): Promise<QuizQuestion[]> {
  const db = await getDB();
  const out: QuizQuestion[] = [];
  for (const h of hashes) {
    const q = await db.get("questions", h);
    if (q) out.push(q);
  }
  return out;
}

export async function clearQuestions() {
  const db = await getDB();
  await db.clear("questions");
}

/** 出題履歴のリセット（回答履歴＋出題済みハッシュ＋問題本体を消去。解析結果は残す） */
export async function resetHistory() {
  await clearAnswers();
  await clearAskedHashes();
  await clearQuestions();
}

/** すべて消去（解析結果も含む） */
export async function resetAll() {
  await clearAnalyses();
  await clearAnswers();
  await clearAskedHashes();
  await clearQuestions();
}
