import { SHOP_CATEGORY_NAMES } from "./presentation";
import { unstable_cache, revalidateTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anonClient";
import type { Category } from "./catalog";
export const CATEGORY_CACHE_TAG = "public-categories";
export const fetchCategories = unstable_cache(async (): Promise<Category[]> => {
  const client = createAnonClient();
  if (!client) return [];
  const { data, error } = await client.from("categories").select("*").order("created_at").order("id");
  if (error) throw new Error("カテゴリの取得に失敗しました");
  return ((data ?? []) as Category[]).map(({ id, name, presentation_key }) => ({ id, name, presentation_key }))
    .sort((a, b) => {
      const rank = (c: Category) => { const i = (SHOP_CATEGORY_NAMES as readonly string[]).indexOf(c.presentation_key || c.name); return i < 0 ? SHOP_CATEGORY_NAMES.length : i; };
      return rank(a) - rank(b);
    });
}, ["public-categories-v1"], { tags: [CATEGORY_CACHE_TAG], revalidate: 60 });
export function revalidateCategories() { revalidateTag(CATEGORY_CACHE_TAG, { expire: 0 }); }
