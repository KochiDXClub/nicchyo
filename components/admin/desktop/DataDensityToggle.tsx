/**
 * データ密度切り替えコンポーネント
 * テーブルの行の高さを変更してデータ密度を調整
 */

import React from "react";

export type DataDensity = "compact" | "standard" | "spacious";

interface DataDensityToggleProps {
  density: DataDensity;
  onChange: (density: DataDensity) => void;
}

/**
 * 密度ごとの設定
 */
export const DENSITY_CONFIG = {
  compact: {
    label: "コンパクト",
    rowHeight: 60,
    padding: "px-4 py-2",
    fontSize: "text-xs",
    icon: "≡",
  },
  standard: {
    label: "標準",
    rowHeight: 73,
    padding: "px-6 py-4",
    fontSize: "text-sm",
    icon: "☰",
  },
  spacious: {
    label: "ゆったり",
    rowHeight: 96,
    padding: "px-6 py-6",
    fontSize: "text-base",
    icon: "▤",
  },
} as const;

export const DataDensityToggle = React.memo(function DataDensityToggle({
  density,
  onChange,
}: DataDensityToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600">表示密度:</span>
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {(Object.entries(DENSITY_CONFIG) as [DataDensity, typeof DENSITY_CONFIG[DataDensity]][]).map(
          ([key, config]) => (
            <button
              type="button"
              key={key}
              onClick={() => onChange(key)}
              className={`px-3 py-1 text-xs font-medium rounded transition ${
                density === key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title={config.label}
              aria-label={`${config.label}表示に切り替え`}
              aria-pressed={density === key}
            >
              <span className="mr-1" aria-hidden="true">
                {config.icon}
              </span>
              {config.label}
            </button>
          )
        )}
      </div>
    </div>
  );
});
