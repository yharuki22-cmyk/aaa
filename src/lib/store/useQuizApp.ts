"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ExtractedSegment,
  HistoryStats,
  PdfAnalysis,
  QuizQuestion,
} from "../quiz/types";
import {
  validatePdfFile,
  sanitizeFileName,
  MAX_FILE_SIZE_LABEL,
} from "../pdf/fileValidation";
import { processPdf, type ProcessProgress } from "../pdf/extract";
import { cacheFile } from "../pdf/fileCache";
import { generateQuiz, checkAiStatus } from "../quiz/generate";
import { scoreQuiz, toAnswerRecords, type ScoreResult } from "../quiz/scoring";
import { computeStats, pickReviewQuestions } from "../history/stats";
import {
  saveAnalysis,
  getAllAnalyses,
  deleteAnalysis,
  addAnswerRecords,
  getAllAnswers,
  addAskedHashes,
  getAskedHashes,
  saveQuestions,
  getQuestionsByHashes,
  resetHistory as dbResetHistory,
} from "../history/db";

export type QuizMode = "normal" | "review";

const QUESTIONS_PER_SET = 10;

export function useQuizApp() {
  const [analyses, setAnalyses] = useState<PdfAnalysis[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessProgress | null>(null);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selections, setSelections] = useState<Array<number | null>>([]);
  const [graded, setGraded] = useState<ScoreResult | null>(null);
  const [unansweredWarning, setUnansweredWarning] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | undefined>();
  const [mode, setMode] = useState<QuizMode>("normal");

  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初期ロード：解析結果・履歴・AI状態を復元
  useEffect(() => {
    (async () => {
      try {
        const [a, answers, ai] = await Promise.all([
          getAllAnalyses(),
          getAllAnswers(),
          checkAiStatus(),
        ]);
        setAnalyses(a);
        setStats(computeStats(answers));
        setAiConfigured(ai);
      } catch (e) {
        // 初期化失敗は致命的ではない
        setStats(computeStats([]));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const refreshStats = useCallback(async () => {
    const answers = await getAllAnswers();
    setStats(computeStats(answers));
  }, []);

  const allSegments = useCallback((): ExtractedSegment[] => {
    return analyses.flatMap((a) => a.segments);
  }, [analyses]);

  // PDFアップロード＆解析
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setProcessing(true);
      try {
        for (const file of arr) {
          const safeName = sanitizeFileName(file.name);
          const v = validatePdfFile({
            name: file.name,
            size: file.size,
            type: file.type,
          });
          if (!v.ok) {
            setError(v.error ?? "ファイルを受け付けられません。");
            continue;
          }
          setProgress({
            pdfName: safeName,
            page: 0,
            totalPages: 0,
            stage: "解析を開始します",
            percent: 0,
          });
          try {
            cacheFile(safeName, file);
            const analysis = await processPdf(file, safeName, (p) =>
              setProgress(p)
            );
            await saveAnalysis(analysis);
            setAnalyses((prev) => {
              const rest = prev.filter((x) => x.pdfName !== analysis.pdfName);
              return [...rest, analysis];
            });
          } catch (e) {
            setError(
              `「${safeName}」の解析に失敗しました。PDFが破損しているか、対応していない形式の可能性があります。`
            );
          }
        }
      } finally {
        setProcessing(false);
        setProgress(null);
      }
    },
    []
  );

  const removeAnalysis = useCallback(async (pdfName: string) => {
    await deleteAnalysis(pdfName);
    setAnalyses((prev) => prev.filter((a) => a.pdfName !== pdfName));
  }, []);

  // 10問生成（通常モード）
  const generateNext = useCallback(async () => {
    if (generating) return;
    setError(null);
    setGenNote(undefined);
    setMode("normal");
    const segs = allSegments();
    if (segs.length === 0) {
      setError("先にPDFをアップロードしてください。");
      return;
    }
    setGenerating(true);
    try {
      const asked = await getAskedHashes();
      const result = await generateQuiz(segs, {
        count: QUESTIONS_PER_SET,
        excludeHashes: asked,
      });
      if (result.questions.length === 0) {
        setError(
          "問題を生成できませんでした。線引き箇所を増やすか、別のPDFを追加してください。"
        );
        return;
      }
      setQuestions(result.questions);
      setSelections(new Array(result.questions.length).fill(null));
      setGraded(null);
      setUnansweredWarning([]);
      setGenNote(
        result.note ??
          (result.usedAi ? undefined : "ローカル生成モードで作成しました。")
      );
      // 出題履歴・問題本体を保存
      await saveQuestions(result.questions);
      await addAskedHashes(result.questions.map((q) => q.hash));
    } catch (e) {
      setError("問題生成中にエラーが発生しました。");
    } finally {
      setGenerating(false);
    }
  }, [generating, allSegments]);

  // 復習モード（間違えた問題を最大10問）
  const startReview = useCallback(async () => {
    if (generating) return;
    setError(null);
    setGenNote(undefined);
    setGenerating(true);
    try {
      const answers = await getAllAnswers();
      const wrongHashes = Array.from(
        new Set(answers.filter((r) => !r.isCorrect).map((r) => r.hash))
      );
      const pool = await getQuestionsByHashes(wrongHashes);
      const review = pickReviewQuestions(pool, answers, QUESTIONS_PER_SET);
      if (review.length === 0) {
        setError("復習できる間違えた問題がまだありません。");
        return;
      }
      setMode("review");
      setQuestions(review);
      setSelections(new Array(review.length).fill(null));
      setGraded(null);
      setUnansweredWarning([]);
      setGenNote(`復習モード：過去に間違えた ${review.length} 問を出題します。`);
    } catch (e) {
      setError("復習問題の取得に失敗しました。");
    } finally {
      setGenerating(false);
    }
  }, [generating]);

  const select = useCallback(
    (qIndex: number, choiceIndex: number) => {
      if (graded) return; // 採点後は変更不可
      setSelections((prev) => {
        const next = [...prev];
        next[qIndex] = choiceIndex;
        return next;
      });
      setUnansweredWarning((prev) => prev.filter((i) => i !== qIndex));
    },
    [graded]
  );

  // 答え合わせ
  const grade = useCallback(async () => {
    if (graded) return;
    const result = scoreQuiz(questions, selections);
    if (result.unanswered.length > 0) {
      setUnansweredWarning(result.unanswered);
      return;
    }
    setUnansweredWarning([]);
    setGraded(result);
    // 履歴を保存（復習モードでも記録する）
    try {
      await addAnswerRecords(toAnswerRecords(result));
      await refreshStats();
    } catch (e) {
      // 保存失敗は表示済みの採点結果に影響しない
    }
  }, [graded, questions, selections, refreshStats]);

  // 再挑戦（同じ問題をやり直す）
  const retry = useCallback(() => {
    setSelections(new Array(questions.length).fill(null));
    setGraded(null);
    setUnansweredWarning([]);
  }, [questions.length]);

  // 出題履歴のリセット
  const resetHistory = useCallback(async () => {
    await dbResetHistory();
    await refreshStats();
    setGenNote("出題履歴をリセットしました。");
  }, [refreshStats]);

  return {
    // state
    analyses,
    loaded,
    aiConfigured,
    processing,
    progress,
    questions,
    selections,
    graded,
    unansweredWarning,
    generating,
    genNote,
    mode,
    stats,
    error,
    maxFileSizeLabel: MAX_FILE_SIZE_LABEL,
    // actions
    uploadFiles,
    removeAnalysis,
    generateNext,
    startReview,
    select,
    grade,
    retry,
    resetHistory,
    setError,
  };
}
