/**
 * 管理画面のタブ
 *
 * 分散していた設定画面を1ページにまとめるための下線タブ。
 * URL の ?tab= と同期させて、特定タブへ直接リンクできるようにする。
 */

"use client";

import React from "react";

export interface AdminTab<T extends string> {
  key: T;
  label: string;
  /** 危険な操作など、注意を促したいタブに付ける */
  tone?: "default" | "danger";
}

export function AdminTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly AdminTab<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div
        role="tablist"
        aria-label="設定カテゴリ"
        className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === value;
          const activeColor =
            tab.tone === "danger" ? "border-rose-500 text-rose-700" : "border-slate-900 text-slate-900";
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? activeColor
                  : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
