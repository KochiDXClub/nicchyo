import { redirect } from "next/navigation";

/**
 * 週次セキュリティレポートは管理画面配下（/admin/security-reports）へ移設した。
 * 既存のブックマークやリンクのために、旧URLはリダイレクトだけ残す。
 */
export const dynamic = "force-dynamic";

export default function LegacyReportsPage() {
  redirect("/admin/security-reports");
}
