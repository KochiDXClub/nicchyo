import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * ボタン。
 *
 * 見た目は「いま画面にあるボタン」から採った。いちばん多い主ボタンは
 * 丸（rounded-full）・amber-600・ホバーで一段明るくなる、という形をしている。
 * ホバーで暗くするのは旧世代の名残なので、新しく書くときは明るくする側に揃える。
 *
 * どれを使うかは docs/DESIGN_SYSTEM.md を見る。
 */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * primary   … その画面でいちばんしてほしいこと。1画面に1つ
   * ink       … 読み物のページの主ボタン。amber を使うと本文より目立ちすぎる場面用
   * secondary … primary と並べる二番手。amber の縁取り
   * quiet     … 主張させたくない操作（閉じる・あとで・切り替え）
   * ghost     … 面を持たない。アイコンだけのものや、密に並ぶもの
   */
  variant?: "primary" | "ink" | "secondary" | "quiet" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  /** pill=丸。soft=角丸12px（フォームの中など、丸くしすぎたくないとき） */
  shape?: "pill" | "soft";
};

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:   "bg-amber-600 text-white shadow-sm hover:bg-amber-500 active:bg-amber-600",
  ink:       "bg-nicchyo-ink text-white hover:bg-black",
  secondary: "border border-amber-200 bg-white text-amber-800 shadow-sm hover:bg-amber-50",
  quiet:     "border border-line bg-white text-nicchyo-ink/70 shadow-sm hover:bg-nicchyo-base",
  ghost:     "text-nicchyo-ink/70 hover:bg-nicchyo-ink/[0.06]",
};

const sizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm:   "h-9 gap-1.5 px-4 text-xs",
  md:   "h-11 gap-2 px-6 text-sm",
  lg:   "h-12 gap-2 px-8 text-base",
  icon: "h-10 w-10",
};

/**
 * ボタンのクラスだけが欲しいとき用。
 * next/link や <a> をボタンの見た目にする箇所が多いので、そこで使う。
 * 見た目を合わせるためにクラスを写経しない。
 */
export function buttonClass({
  variant = "primary",
  size = "md",
  shape = "pill",
  className,
}: Pick<ButtonProps, "variant" | "size" | "shape"> & { className?: string } = {}) {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold",
    "transition duration-200 ease-out-soft",
    // 押した感触。reduced motion のときは動かさない
    "active:scale-95 motion-reduce:active:scale-100 motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-45",
    shape === "pill" ? "rounded-chip" : "rounded-btn",
    variantClass[variant],
    sizeClass[size],
    className
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      // eslint-disable-next-line react/button-has-type
      type={type}
      className={buttonClass({ variant, size, shape, className })}
      {...props}
    />
  )
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
