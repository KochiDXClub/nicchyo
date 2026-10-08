import { redirect } from "next/navigation";

/**
 * ページ公開設定は「設定」ページの「公開範囲」タブへ統合した。
 * 設定の入口を1箇所に保つため、旧URLはリダイレクトだけ残す。
 */
export const dynamic = "force-dynamic";

export default function LegacyPageVisibilityPage() {
  redirect("/admin/settings?tab=visibility");
}
