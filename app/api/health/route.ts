import { NextResponse } from "next/server";
import { isUpstashConfigured } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 死活監視・アラート用のヘルスチェック（Issue #352）。
 *
 * 本番は Vercel でマルチインスタンス運用のため、Upstash 未設定だと
 * レート制限が in-memory フォールバックになり実効性を失う
 * （`lib/security/rateLimit.ts` 参照）。リクエストそのものは通しつつ、
 * この設定ミスを外形監視（uptime監視・デプロイ後のスモークテスト等）が
 * 検知できるよう、本番でだけ 503 を返す。
 *
 * プレビュー・開発環境では Upstash を設定していないのが普通なので、
 * VERCEL_ENV=production のときだけ厳しく見る。
 *
 * 認証なしで誰でも呼べる。「何が degraded か」まで公開すると、攻撃者に
 * 「このサイトはレート制限が分散環境で効いていない」と直接教えてしまうため、
 * 公開するのは ok/degraded の2値だけにする。詳細（どの設定が原因か）は
 * サーバーログ（起動時の console.error、上のコメント参照）でのみ確認する。
 *
 * DBアクセスの無い軽量な GET なのでレート制限は意図的にかけていない
 * （書き込みAPIではなく、Upstash未設定を検知する目的そのものと衝突するため）。
 */
export async function GET() {
  const isProduction = process.env.VERCEL_ENV === "production";
  const isDegraded = isProduction && !isUpstashConfigured;

  return NextResponse.json(
    { status: isDegraded ? "degraded" : "ok" },
    { status: isDegraded ? 503 : 200 }
  );
}
