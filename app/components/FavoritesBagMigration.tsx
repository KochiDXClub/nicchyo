"use client";

/**
 * 旧バッグ（買い物リスト）の中身をお気に入りへ1回だけ移す。
 *
 * バッグは廃止したが、localStorage に中身が残っている利用者がいる。
 * どのページから戻ってきても取りこぼさないよう、レイアウトに常駐させて
 * 起動時に1回だけ走らせる。移行済みの印は lib/favoriteShops.ts が持つ。
 */

import { useEffect } from "react";
import { migrateBagItemsToFavorites } from "@/lib/favoriteShops";

export default function FavoritesBagMigration() {
  useEffect(() => {
    migrateBagItemsToFavorites();
  }, []);

  return null;
}
