import { cn } from "@/lib/utils/cn";
import type { ShopImageKind } from "@/lib/shopImages";

/** 全周写真として登録できない写真のときに出す文。選んだ写真の比率が 2:1 でないとき */
export const PANORAMA_RATIO_MESSAGE =
  "全周写真は、全周カメラで撮った横:縦が 2:1 の写真だけ登録できます。この写真は比率が違うので、普通の写真として登録してください。";

/**
 * 店舗写真の種類（普通の写真／全周カメラの写真）を選ぶ。
 * 出店者の写真登録と、運営の現地登録で同じものを使う。
 *
 * 全周写真は、バナーにはサムネイルを出し、タップした拡大表示でドラッグして見渡せる。
 * 横:縦が 2:1 でない写真は全周として見せられないので、registrable が false のときは選べないようにする。
 */
export function ShopImageKindField({
  value,
  onChange,
  panoramaAvailable,
  disabled = false,
  className,
}: {
  value: ShopImageKind;
  onChange: (next: ShopImageKind) => void;
  /** 選んだ写真が全周写真として登録できる（横:縦が 2:1）か */
  panoramaAvailable: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const options: { kind: ShopImageKind; label: string }[] = [
    { kind: "normal", label: "普通の写真" },
    { kind: "panorama", label: "全周カメラ（360°）の写真" },
  ];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div role="radiogroup" aria-label="写真の種類" className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const unavailable = option.kind === "panorama" && !panoramaAvailable;
          const selected = value === option.kind;
          return (
            <button
              key={option.kind}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled || unavailable}
              onClick={() => onChange(option.kind)}
              className={cn(
                "min-h-11 rounded-chip px-3 text-[13px] font-semibold transition disabled:opacity-40",
                selected ? "bg-amber-50 text-amber-900 ring-2 ring-amber-500" : "bg-white text-nicchyo-ink ring-1 ring-line"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {!panoramaAvailable && <p className="text-xs text-nicchyo-ink/55">{PANORAMA_RATIO_MESSAGE}</p>}
    </div>
  );
}
