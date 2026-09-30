import { useMemo } from "react";
import { formatEventDate, listSundaysInRange } from "@/lib/market/calendar";

/**
 * 見どころにする週を選ぶUI。
 *
 * 単発イベントなら選択肢は1つだけ（その日）。連続開催イベントなら
 * 期間内の日曜が並び、個別に選べる（「8月はずっと出店するが、
 * 見どころにしたいのは最初の週だけ」に対応するため）。
 * 「すべて選択」で従来どおり期間全体を見どころにすることもできる。
 */
export function HighlightWeekPicker({
  eventDate,
  endDate,
  selected,
  onChange,
}: {
  eventDate: string;
  endDate: string | null;
  selected: string[];
  onChange: (dates: string[]) => void;
}) {
  const sundays = useMemo(() => listSundaysInRange(eventDate, endDate), [eventDate, endDate]);

  const toggle = (dateIso: string) => {
    onChange(
      selected.includes(dateIso)
        ? selected.filter((d) => d !== dateIso)
        : [...selected, dateIso]
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">見どころにする週</span>
        {sundays.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange(sundays)}
              className="text-[11px] font-semibold text-amber-600 hover:underline"
            >
              すべて選択
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] font-semibold text-slate-400 hover:underline"
            >
              すべて解除
            </button>
          </div>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        選んだ週だけカードの主役として大きく表示されます。1週につき1件までです
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sundays.map((dateIso) => {
          const checked = selected.includes(dateIso);
          return (
            <button
              key={dateIso}
              type="button"
              onClick={() => toggle(dateIso)}
              className={`rounded-full border-2 px-2.5 py-1 text-xs font-semibold transition ${
                checked
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              {formatEventDate(dateIso)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
