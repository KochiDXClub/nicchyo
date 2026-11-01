import { NextResponse } from "next/server";
import { fetchEffectivePageVisibility } from "@/lib/pageVisibility/server";

/**
 * ページ公開設定（公開API）
 *
 * クライアント側でリンクの表示/非表示を判定するために使う。
 * 設定自体は機密ではない（ロール別の公開状態とリダイレクト先のみ）。
 */

export const runtime = "nodejs";
// 60秒キャッシュ — proxy.ts 側のキャッシュ TTL と揃える
export const revalidate = 60;

export async function GET() {
  return NextResponse.json(await fetchEffectivePageVisibility());
}
