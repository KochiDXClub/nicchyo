"use client";

import { useCategories } from "@/lib/categories/CategoryContext";
import { categoryKey } from "@/lib/categories/catalog";
import { useT } from "@/lib/i18n/LocaleContext";

export default function CategoryDemoChips() {
  const categories = useCategories();
  const t = useT();
  return (
    <div className="landing-m-chips">
      {categories.slice(0, 3).map((category) => (
        <span key={category.id} className={categoryKey(category) === "食べ物" ? "landing-on" : undefined}>
          {t(category.name)}
        </span>
      ))}
    </div>
  );
}
