import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** AIが利用可能に設定されているかをクライアントへ知らせる（キー自体は返さない） */
export function GET() {
  const enabled =
    process.env.AI_ENABLED === "true" && Boolean(process.env.AI_API_KEY);
  return NextResponse.json({
    configured: enabled,
    model: enabled ? process.env.AI_MODEL ?? "gpt-4o-mini" : null,
  });
}
