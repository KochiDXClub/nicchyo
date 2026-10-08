import { AdminLayout, AdminPageHeader } from "@/components/admin";
import MapViewRangeClient from "./MapViewRangeClient";

export const dynamic = "force-dynamic";

/**
 * マップの表示範囲（動かせる範囲）を目で見て決めるページ
 *
 * 認可は app/(public)/admin/layout.tsx が行う（管理者以外はトップへ）。
 * 保存先は map_view_settings。反映されるのは MapLibre 版の描画。
 */
export default function AdminMapViewPage() {
  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Map"
        title="マップの表示範囲"
        description="来訪者のマップをどこまで動かせるかを、地図の上で長方形を動かして決める"
      />
      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        <MapViewRangeClient />
      </div>
    </AdminLayout>
  );
}
