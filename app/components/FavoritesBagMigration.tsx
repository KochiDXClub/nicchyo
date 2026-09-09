"use client";

/**
 * 旧バッグ（買い物リスト）の中身をお気に入りへ1回だけ移す。
 *
 * バッグは廃止したが、localStorage に中身が残っている利用者がいる。
 * どのページから戻ってきても取りこぼさないよう、レイアウトに常駐させて
 * 起動時に1回だけ走らせる。移行済みの印は lib/favoriteShops.ts が持つ。
 *
 * 移行は黙って済ませない。利用者から見ると、入れたはずのものが別の場所へ
 * 動いている。どこへ移ったか（と、移せなかったものがあるか）を伝える。
 *
 * TODO: バッグを載せたバージョンを使う端末がいなくなったら、このコンポーネントと
 * lib/favoriteShops.ts の移行まわりごと消す。目安は 2027-03（リリースから半年）。
 */

import { useEffect } from "react";
import toast from "react-hot-toast";
import { migrateBagItemsToFavorites } from "@/lib/favoriteShops";

export default function FavoritesBagMigration() {
  useEffect(() => {
    let result;
    try {
      result = migrateBagItemsToFavorites();
    } catch {
      // 保存に失敗しても印は立っていないので、次の起動でやり直せる。
      // ここで落として画面全体を巻き込まない
      return;
    }
    if (!result || result.migrated === 0) return;

    // 店が分からないものは地図に出せないので移せていない。黙って消さずに伝える
    const skipped =
      result.skipped > 0 ? `（お店が分からない${result.skipped}品は移せませんでした）` : "";
    toast(`買い物リストの${result.migrated}品をお気に入りに移しました${skipped}`, {
      duration: 6000,
      icon: "❤️",
    });
  }, []);

  return null;
}
