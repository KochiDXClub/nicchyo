import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 面（カード）。
 *
 * 地はクリーム（nicchyo-base）で、その上に白い面を置く、というのが
 * このプロダクトの基本の組み立て。縁は border ではなく ring で描く。
 * ring はレイアウトに幅を足さないので、面を並べたときに 1px ぶんズレない。
 *
 * elevation は「どれだけ浮いているか」で選ぶ。lifted はその画面の主役を
 * ひとつだけ持ち上げるためのもので、並べると全部が主役になって効かなくなる。
 */
type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * flat   … 罫だけ。面を区切りたいだけのとき
   * raised … 既定。一覧に並ぶカード
   * lifted … その画面の主役。1画面に1つ
   * float  … 地から浮いている固定物（パネル・ポップオーバー）
   */
  elevation?: "flat" | "raised" | "lifted" | "float";
  /** none は画像を端まで出すカード用 */
  padding?: "none" | "sm" | "md" | "lg";
  /** div 以外で出したいとき（section / article / li など） */
  as?: React.ElementType;
};

const elevationClass: Record<NonNullable<SurfaceProps["elevation"]>, string> = {
  flat:   "rounded-card bg-white ring-1 ring-line",
  raised: "rounded-card bg-white ring-1 ring-line shadow-card",
  lifted: "rounded-card bg-white ring-1 ring-line shadow-lift",
  float:  "rounded-panel bg-white ring-1 ring-line shadow-float",
};

const paddingClass: Record<NonNullable<SurfaceProps["padding"]>, string> = {
  none: "",
  sm:   "p-4",
  md:   "p-5 sm:p-6",
  lg:   "p-6 sm:p-8",
};

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, elevation = "raised", padding = "md", as: Tag = "div", ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(elevationClass[elevation], paddingClass[padding], className)}
      {...props}
    />
  )
);

Surface.displayName = "Surface";
export type { SurfaceProps };
