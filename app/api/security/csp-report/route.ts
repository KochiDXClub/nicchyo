import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ブラウザが送る違反レポートは数百バイト。これを超えるものは読まずに捨てる
const MAX_REPORT_BYTES = 8 * 1024;
const MAX_LOG_CHARS = 1000;

export async function POST(request: NextRequest) {
  // ブラウザが自動送信するエンドポイントで認証も同一オリジン確認もできないため、
  // 認可の代わりにIPあたりの上限で連打・悪用を抑える（Issue #352）。
  // 壊れたCSPだと1ページで複数件飛ぶこともあるため、他の書き込みAPIより緩めにする
  const rateLimited = await enforceRateLimit(request, {
    bucket: "csp-report-post",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  // 保存はしない（メモリに溜めても誰も読まない）。ログに残すだけにして、運営はログで確認する
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REPORT_BYTES) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const text = await request.text().catch(() => "");
  if (text && text.length <= MAX_REPORT_BYTES) {
    console.warn("[csp-report]", text.slice(0, MAX_LOG_CHARS));
  }

  return NextResponse.json({ ok: true });
}
