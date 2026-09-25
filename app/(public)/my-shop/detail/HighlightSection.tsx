import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";

const requiredMark = <span className="ml-1 text-[11px] font-semibold text-rose-600">*</span>;

const ILLUSTRATION_OPTIONS = [
  {
    id: "obaasan",
    label: "おせっかいばあちゃん",
    src: "/images/obaasan_transparent.png",
  },
];

export function HighlightSection({
  highlight,
  onHighlightChange,
  error,
}: {
  highlight: string;
  onHighlightChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
}) {
  const [editHighlight, setEditHighlight] = useState(false);
  const [selectedIllustration, setSelectedIllustration] = useState(
    "/images/obaasan_transparent.png"
  );
  const [showIllustrationOptions, setShowIllustrationOptions] = useState(false);
  useEffect(() => {
    if (!editHighlight) {
      setShowIllustrationOptions(false);
    }
  }, [editHighlight]);

  const handleIllustrationToggle = () => {
    if (!editHighlight) return;
    setShowIllustrationOptions((prev) => !prev);
  };

  return (
    <section className="py-6 text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <button
            type="button"
            aria-label="紹介コメントイラスト"
            onClick={handleIllustrationToggle}
            className="h-16 w-16 rounded-full border border-amber-200 bg-white p-2 shadow-sm transition hover:border-amber-300"
          >
            <Image
              src={selectedIllustration}
              alt="にちよおばあちゃん"
              width={64}
              height={64}
              className="h-full w-full rounded-full object-cover"
            />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-500">紹介コメント</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditHighlight((prev) => !prev)}
          className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
        >
          {editHighlight ? "閉じる" : "編集する"}
        </button>
      </div>
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-slate-700">
        {highlight || "未入力"}
      </div>
      {editHighlight && (
        <div className="mt-4">
          <label className="block text-sm text-slate-700">
            お店のイチ押しポイント{requiredMark}
            <textarea
              rows={4}
              value={highlight}
              onChange={onHighlightChange}
              placeholder="例: 朝採れ野菜をその場で袋詰めします"
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none ${
                error
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-orange-200 focus:border-amber-400"
              }`}
              aria-invalid={!!error}
              required
            />
            {error && (
              <span className="mt-1 block text-[11px] text-rose-600">
                {error}
              </span>
            )}
          </label>
        </div>
      )}
      {editHighlight && showIllustrationOptions && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {ILLUSTRATION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedIllustration(option.src);
                setShowIllustrationOptions(false);
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                selectedIllustration === option.src
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              <Image
                src={option.src}
                alt={option.label}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
