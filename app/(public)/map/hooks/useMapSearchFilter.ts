import { useEffect, useMemo, useState } from "react";
import { buildSearchIndex } from "../../search/lib/searchIndex";
import { useShopSearch } from "../../search/hooks/useShopSearch";
import type { Shop } from "../data/shops";

/**
 * 地図上の検索バー・ジャンルフィルター・お気に入り絞り込みの状態。
 *
 * 「/search から渡ってきた検索結果（searchMarkerPayload）」や「AIのおすすめ
 * （aiMarkerPayload）」とは別の状態で、こちらは地図画面に常設の検索バー・
 * ジャンルチップ自体の入力を持つ。`favoriteShopIds` は行動シグナルとして
 * 他の場所（近くの店のおすすめ理由づけなど）でも使うため、このフックの
 * 外（呼び出し側）で取得して渡してもらう。
 */
export function useMapSearchFilter({
  shops,
  favoriteShopIds,
  initialQuery = "",
}: {
  shops: Shop[];
  favoriteShopIds: number[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  // お気に入り絞り込み。歩きながら1タップで「あとで戻る店」だけの地図にできる
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // 最後の1件を外したら絞り込みも解除する（0件の地図に取り残さない）
  useEffect(() => {
    if (favoriteShopIds.length === 0) setFavoritesOnly(false);
  }, [favoriteShopIds.length]);

  const searchIndex = useMemo(() => buildSearchIndex(shops), [shops]);
  const results = useShopSearch({
    shops,
    searchIndex,
    textQuery: query,
    category,
    chome: null,
  });

  const shopIds = useMemo(() => {
    const hasTextOrCategory = !!query.trim() || !!category;
    const matchedIds = hasTextOrCategory ? results.map((s) => s.id) : undefined;
    if (!favoritesOnly) return matchedIds;
    // お気に入りチップは検索・ジャンルと重ねて効かせる
    if (!matchedIds) return favoriteShopIds;
    const favoriteSet = new Set(favoriteShopIds);
    return matchedIds.filter((id) => favoriteSet.has(id));
  }, [favoriteShopIds, favoritesOnly, category, query, results]);

  const hasFilter = !!query.trim() || !!category || favoritesOnly;

  /** 検索バー自体のクリア（/search 由来の searchMarkerPayload は呼び出し側が別途クリアする） */
  const clearFilters = () => {
    setQuery("");
    setCategory(null);
    setFavoritesOnly(false);
  };

  return {
    query,
    setQuery,
    category,
    setCategory,
    favoritesOnly,
    setFavoritesOnly,
    results,
    shopIds,
    hasFilter,
    clearFilters,
  };
}
