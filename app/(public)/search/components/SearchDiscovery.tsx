'use client';

import { useState } from 'react';
import { Tag, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchDiscoveryProps {
  categories: string[];
  onCategorySelect: (category: string) => void;
}

const INITIAL_SHOW = 2;

/**
 * 検索ディスカバリーコンポーネント
 * 検索前の「何を探しますか？」状態を表示し、
 * ユーザーが直感的に探索を開始できるようにする
 */
export default function SearchDiscovery({
  categories,
  onCategorySelect,
}: SearchDiscoveryProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const visibleCategories = categoriesExpanded ? categories : categories.slice(0, INITIAL_SHOW);

  return (
    <div className="space-y-3 pt-2 animate-in fade-in duration-500">
      <section>
        <div className="mb-2 flex items-center gap-2 text-amber-800">
          <Tag className="h-3.5 w-3.5" />
          <h3 className="text-xs font-bold tracking-wider uppercase">ジャンルから探す</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => onCategorySelect(cat)}
              className="rounded-full border border-amber-100 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 active:scale-95"
            >
              {cat}
            </button>
          ))}
          {categories.length > INITIAL_SHOW && (
            <button
              type="button"
              onClick={() => setCategoriesExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              aria-expanded={categoriesExpanded}
            >
              {categoriesExpanded ? (
                <><ChevronUp className="h-3 w-3" />閉じる</>
              ) : (
                <><ChevronDown className="h-3 w-3" />あと{categories.length - INITIAL_SHOW}件</>
              )}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
