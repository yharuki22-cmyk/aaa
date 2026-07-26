import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildExcerpts,
} from "@/lib/quiz/prompt";
import { validateQuestions } from "@/lib/quiz/validate";
import type { ExtractedSegment } from "@/lib/quiz/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const segmentSchema = z.object({
  id: z.string(),
  pdfName: z.string(),
  page: z.number(),
  text: z.string(),
  source: z.enum(["highlight", "underline-image", "ocr", "fulltext"]),
  emphasized: z.boolean(),
});

const requestSchema = z.object({
  segments: z.array(segmentSchema).min(1),
  count: z.number().int().min(1).max(20).default(10),
  excludeHashes: z.array(z.string()).default([]),
});

/**
 * サーバー側でのみAI（OpenAI互換API）を呼び出す。
 * APIキーはブラウザに渡らない。PDF抜粋のみをAIに送る。
 */
export async function POST(req: NextRequest) {
  const aiEnabled =
    process.env.AI_ENABLED === "true" && Boolean(process.env.AI_API_KEY);
  if (!aiEnabled) {
    // AI未設定。クライアントはローカル生成にフォールバックする。
    return NextResponse.json(
      { error: "ai_not_configured", message: "AIが設定されていません。" },
      { status: 501 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await req.json();
    body = requestSchema.parse(json);
  } catch (e) {
    return NextResponse.json(
      { error: "bad_request", message: "リクエスト形式が不正です。" },
      { status: 400 }
    );
  }

  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const excerpts = buildExcerpts(body.segments as ExtractedSegment[]);

  const exclusionNote =
    body.excludeHashes.length > 0
      ? `\n\n注意: 直近に出題済みのため、同じ内容の問題は避けてください。`
      : "";

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserPrompt(excerpts, body.count) + exclusionNote,
          },
        ],
      }),
    });

    if (!resp.ok) {
      // APIキー本文などはログに出さない
      console.error("[generate] AI API error status:", resp.status);
      return NextResponse.json(
        {
          error: "ai_error",
          message:
            "AIによる問題生成に失敗しました。しばらくしてから再度お試しください。",
        },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        {
          error: "ai_invalid_json",
          message: "AIの応答をJSONとして解釈できませんでした。",
        },
        { status: 502 }
      );
    }

    // スキーマ検証：不正な問題は破棄
    const { valid, rejected } = validateQuestions(parsed);
    const exclude = new Set(body.excludeHashes);
    const filtered = valid.filter((q) => !exclude.has(q.hash));

    return NextResponse.json({
      questions: filtered,
      rejectedCount: rejected.length,
      generatedBy: "ai",
    });
  } catch (e) {
    console.error("[generate] unexpected error");
    return NextResponse.json(
      {
        error: "ai_error",
        message: "AI呼び出し中にエラーが発生しました。",
      },
      { status: 502 }
    );
  }
}
