import { AdminLayout, AdminPageHeader } from "@/components/admin";
import MapPerfClient from "./MapPerfClient";

export const dynamic = "force-dynamic";

/**
 * マップ描画のパフォーマンス計測ページ
 *
 * 認可は app/(public)/admin/layout.tsx が行う（管理者以外はトップへ）。
 * 実際のマップページを iframe で読み込み、その中で計測を走らせる。
 */
export default function MapPerfPage() {
  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Performance" title="マップ描画の計測" />
      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        <MapPerfClient />
      </div>
    </AdminLayout>
  );
}
