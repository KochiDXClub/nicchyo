import { SHOP_INVITE_RULES } from "@/lib/vendor/shopPermissions";

const MAX_USES_OPTIONS = Array.from(
  { length: SHOP_INVITE_RULES.maxUses - SHOP_INVITE_RULES.minUses + 1 },
  (_, i) => SHOP_INVITE_RULES.minUses + i,
);

/** 招待リンク1本で入れる人数（1〜5人）を選ぶ。店舗側の画面と運営の店舗詳細で共通 */
export default function MaxUsesPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-nicchyo-ink/55">このリンクで入れる人数</p>
      <div role="radiogroup" aria-label="入れる人数" className="mt-1.5 flex flex-wrap gap-1.5">
        {MAX_USES_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`inline-flex h-10 min-w-10 items-center justify-center rounded-chip px-3 text-sm font-semibold transition ${
              value === n ? "bg-amber-600 text-white shadow-sm" : "border border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
            }`}
          >
            {n}人
          </button>
        ))}
      </div>
    </div>
  );
}
