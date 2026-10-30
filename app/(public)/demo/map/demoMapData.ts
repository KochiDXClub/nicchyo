/**
 * デモマップ用の架空データ
 *
 * 本番の店舗・建物・道（DB）には一切つながない。道は既定の中心線、建物はリポジトリ内の
 * landmarks.json（静的な公開データ）、店舗はここで作る架空の店だけで地図を動かす。
 */

import { getRoadCenterlinePoints } from "../../map/config/roadConfig";
import type { Shop } from "../../map/data/shops";
import type { Landmark } from "../../map/types/landmark";
import landmarksJson from "../../map/data/landmarks.json";

const DEMO_SHOPS = [
  { name: "デモ青果店", ownerName: "デモ 太郎", category: "食材", products: ["トマト", "ナス", "きゅうり"], description: "見本の八百屋です。季節の野菜が並びます。" },
  { name: "デモ屋台 いも天", ownerName: "デモ 花子", category: "食べ物", products: ["いも天", "田舎寿司"], description: "見本の屋台です。揚げたてを出します。" },
  { name: "デモ刃物店", ownerName: "デモ 次郎", category: "道具・工具", products: ["包丁", "鎌", "はさみ"], description: "見本の刃物屋です。" },
  { name: "デモ雑貨 ひなた", ownerName: "デモ 三郎", category: "生活雑貨", products: ["手ぬぐい", "かご"], description: "見本の雑貨屋です。" },
  { name: "デモ苗木店", ownerName: "デモ 四郎", category: "植物・苗", products: ["花苗", "野菜苗"], description: "見本の苗屋です。" },
  { name: "デモ工房 つむぎ", ownerName: "デモ 五子", category: "アクセサリー", products: ["ピアス", "ブローチ"], description: "見本のアクセサリー屋です。" },
  { name: "デモ手仕事の店", ownerName: "デモ 六郎", category: "手作り・工芸", products: ["木のスプーン", "和紙"], description: "見本の工芸品屋です。" },
  { name: "デモ果物店", ownerName: "デモ 七子", category: "食材", products: ["文旦", "ぽんかん"], description: "見本の果物屋です。" },
  { name: "デモ屋台 みたらし", ownerName: "デモ 八郎", category: "食べ物", products: ["みたらし団子", "ところてん"], description: "見本のおやつ屋台です。" },
  { name: "デモ漬物店", ownerName: "デモ 九子", category: "食材", products: ["漬物", "味噌"], description: "見本の漬物屋です。" },
] as const;

/** 道の中心線に沿って、道の北側と南側に交互に並べる（位置は固定。毎回同じ見た目になる） */
export function buildDemoShops(): Shop[] {
  const line = getRoadCenterlinePoints();
  const side = 0.00006;
  return DEMO_SHOPS.map((demo, index) => {
    const t = ((index + 0.5) / DEMO_SHOPS.length) * (line.length - 1);
    const i = Math.floor(t);
    const a = line[i];
    const b = line[Math.min(i + 1, line.length - 1)];
    const f = t - i;
    return {
      id: index + 1,
      position: index + 1,
      lat: a.lat + (b.lat - a.lat) * f + (index % 2 === 0 ? side : -side),
      lng: a.lng + (b.lng - a.lng) * f,
      name: demo.name,
      ownerName: demo.ownerName,
      category: demo.category,
      products: [...demo.products],
      description: demo.description,
      schedule: "毎週日曜（デモ）",
      approvalStatus: "approved",
      visible: true,
    } satisfies Shop;
  });
}

export const DEMO_LANDMARKS = landmarksJson as Landmark[];
