"use client";

import { useCategories } from "@/lib/categories/CategoryContext";
import { categoryKey } from "@/lib/categories/catalog";

export default function CategoryDemoChips() {
  const categories = useCategories();
  return (
    <div className="landing-m-chips">
      {categories.slice(0, 3).map((category) => (
        <span key={category.id} className={categoryKey(category) === "食べ物" ? "landing-on" : undefined}>
          {category.name}
        </span>
      ))}
    </div>
  );
}
