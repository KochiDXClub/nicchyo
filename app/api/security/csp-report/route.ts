import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CspViolation = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "original-policy"?: string;
  };
};

const reportBucket: CspViolation[] = [];

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

  const payload = (await request.json().catch(() => null)) as CspViolation | null;
  if (payload) {
    reportBucket.push(payload);
    if (reportBucket.length > 200) reportBucket.shift();
  }

  return NextResponse.json({ ok: true });
}
