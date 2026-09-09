"use client";

/**
 * お気に入りの購読をまとめる。
 *
 * お気に入りは localStorage に置いてあり、変更は `FAVORITE_SHOPS_UPDATED_EVENT`
 * （同じタブ）と `storage` イベント（別タブ）で伝わる。この配線を画面ごとに
 * 書くと、どこか1つが購読を書き忘れただけでハートの状態が画面間でズレる。
 * 実際にそれが起きていたので、購読は必ずこのフックを通す。
 *
 * 保存は `lib/favoriteShops.ts` の関数を直接呼んでよい（呼べばイベントが飛び、
 * このフックを使っている画面はすべて追従する）。
 */

import { useEffect, useMemo, useState } from "react";
import {
  FAVORITE_SHOPS_KEY,
  FAVORITE_SHOPS_UPDATED_EVENT,
  loadFavoriteEntries,
  type FavoriteEntry,
} from "../favoriteShops";

/**
 * お気に入りの行をそのまま返す。
 *
 * サーバー側では空で描き、マウント後に読み込む（localStorage は
 * サーバーで読めないため、初期値を入れると hydration がズレる）。
 */
export function useFavoriteEntries(): FavoriteEntry[] {
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setEntries(loadFavoriteEntries());
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_SHOPS_KEY) sync();
    };
    window.addEventListener(FAVORITE_SHOPS_UPDATED_EVENT, sync);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(FAVORITE_SHOPS_UPDATED_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return entries;
}

/** 店単位のハートしか見ない画面向け。商品だけ入れた店も1件として返る */
export function useFavoriteShopIds(): number[] {
  const entries = useFavoriteEntries();
  return useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.shopId))),
    [entries],
  );
}

/** マーカーの点灯判定など、含まれるかどうかだけを何度も引く画面向け */
export function useFavoriteShopIdSet(): Set<number> {
  const shopIds = useFavoriteShopIds();
  return useMemo(() => new Set(shopIds), [shopIds]);
}
