"use client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { withCategory, resolveCategory, type Category } from "./catalog";
const UPDATE_EVENT = "nicchyo:categories-updated";
export function notifyCategoriesUpdated() {
  window.dispatchEvent(new Event(UPDATE_EVENT));
  try { localStorage.setItem(UPDATE_EVENT, String(Date.now())); } catch { /* 保存不可でも同じ画面へ通知 */ }
}
const Context = createContext<Category[]>([]);
export function CategoryProvider({ initial, children }: { initial: Category[]; children: ReactNode }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initial);
  const current = useRef(categories);
  current.current = categories;
  useEffect(() => {
    let active = true;
    const refresh = async (bypassCache = false) => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(bypassCache ? `/api/categories?updated=${Date.now()}` : "/api/categories");
        if (!response.ok) return;
        const payload = await response.json();
        if (active && Array.isArray(payload.categories) && JSON.stringify(current.current) !== JSON.stringify(payload.categories)) {
          current.current = payload.categories;
          setCategories(payload.categories);
          // Server ComponentのLPや店舗データも最新の一覧へ揃える。
          router.refresh();
        }
      } catch { /* 一時的な通信失敗では最後の正常な一覧を維持 */ }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 300_000);
    const onStorage = (event: StorageEvent) => { if (event.key === UPDATE_EVENT) void refresh(true); };
    const onUpdate = () => { void refresh(true); };
    const onFocus = () => { void refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(UPDATE_EVENT, onUpdate);
    window.addEventListener("focus", onFocus);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener(UPDATE_EVENT, onUpdate); window.removeEventListener("storage", onStorage); };
  }, [router]);
  return <Context.Provider value={categories}>{children}</Context.Provider>;
}
export const useCategories = () => useContext(Context);
export function useCategorizedShops<T extends { category: string; categoryId?: string; categoryKey?: string }>(shops: T[]): T[] {
  const categories = useCategories();
  return useMemo(() => shops.map(shop => withCategory(shop, categories)), [shops, categories]);
}

/** 選択状態はIDで持ち、画面と検索には常に最新の表示名を渡す。 */
export function useCategoryFilter(initial: string | null) {
  const categories = useCategories();
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const [value, setValue] = useState<string | null>(() => resolveCategory(initial, categories)?.id ?? initial);
  useEffect(() => {
    if (!value || categories.length === 0) return;
    const resolved = resolveCategory(value, categories);
    if (resolved && resolved.id !== value) setValue(resolved.id);
  }, [value, categories]);
  const setCategory = useCallback((next: string | null) => setValue(resolveCategory(next, categoriesRef.current)?.id ?? next), []);
  return [resolveCategory(value, categories)?.name ?? (categories.length ? null : value), setCategory] as const;
}

export function useCategorizedShop<T extends { category: string; categoryId?: string; categoryKey?: string }>(shop: T): T {
  const categories = useCategories();
  return useMemo(() => withCategory(shop, categories), [shop, categories]);
}
