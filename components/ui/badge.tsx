import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 小さい札。状態や分類を一言で示す。
 *
 * 画面では 11px・丸・太字が定着しているのでそれに合わせている。
 * 押せるものには使わない（押せるなら Button の sm）。
 */
type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  /**
   * neutral  … 既定。分類など、意味の色がないもの
   * amber    … 主色。件数や「おすすめ」など、拾ってほしいもの
   * solid    … 塗り。画像やカードの上に重ねるとき
   * favorite … お気に入り
   * ai       … にちよさん（AI）由来
   * info     … 検索でヒットした、など情報の印
   * caution  … 注意。中止・受付終了など
   */
  variant?: "neutral" | "amber" | "solid" | "favorite" | "ai" | "info" | "caution";
};

const variantClass: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral:  "ring-1 ring-line bg-white text-nicchyo-ink/65",
  amber:    "ring-1 ring-amber-200 bg-amber-50 text-amber-800",
  solid:    "bg-nicchyo-ink/70 text-white backdrop-blur-sm",
  favorite: "ring-1 ring-favorite-line bg-favorite-bg text-favorite-fg",
  ai:       "ring-1 ring-ai-line bg-ai-bg text-ai-fg",
  info:     "ring-1 ring-info-line bg-info-bg text-info-fg",
  caution:  "ring-1 ring-rose-200 bg-rose-50 text-rose-700",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-chip px-2.5 py-0.5 text-[11px] font-bold leading-5",
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
}

export type { BadgeProps };
