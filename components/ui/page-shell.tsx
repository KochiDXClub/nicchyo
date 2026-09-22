import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * ページの外枠。
 *
 * これまで 68 個の page.tsx がそれぞれ地の色・最大幅・左右の余白・
 * 下の余白を書いていて、同じクリーム色が bg-[#FDFBF7] / bg-nicchyo-base /
 * from-amber-50 の 3 通りに割れていた。ここに寄せて 1 通りにする。
 *
 * 下の余白は NavigationBar（--nav-bar-height）と端末の下端（--safe-bottom）を
 * 足して出す。pb-24 のような決め打ちだと、ホームインジケータのある端末で
 * 最後の行がナビに隠れる。
 */

/** 最大幅。画面から採った 3 段階しか持たない */
const widthClass = {
  /** 32rem。モバイル前提の一覧（カレンダー・FAQ） */
  narrow: "max-w-[32rem]",
  /** 38rem。読み物と、入力の多いフォーム */
  reading: "max-w-[38rem]",
  /** 64rem。図や表が主役の画面（支援・分析） */
  wide: "max-w-[64rem]",
} as const;

type Width = keyof typeof widthClass;

function bottomSpace(bottomNav: boolean): React.CSSProperties {
  return {
    paddingBottom: bottomNav
      ? "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 2rem)"
      : "calc(var(--safe-bottom, 0px) + 2rem)",
  };
}

type PageShellProps = React.HTMLAttributes<HTMLElement> & {
  /** NavigationBar を出す画面は true（既定）。出さない画面だけ false にする */
  bottomNav?: boolean;
  as?: React.ElementType;
};

/** 地。背景・文字色・最低の高さ・下の逃げをここだけで決める */
export function PageShell({
  className,
  bottomNav = true,
  as: Tag = "div",
  style,
  ...props
}: PageShellProps) {
  return (
    <Tag
      className={cn("min-h-screen bg-nicchyo-base text-nicchyo-ink", className)}
      style={{ ...bottomSpace(bottomNav), ...style }}
      {...props}
    />
  );
}

type PageContainerProps = React.HTMLAttributes<HTMLElement> & {
  width?: Width;
  as?: React.ElementType;
};

/** 中身の幅と左右の余白。PageShell の中に置く */
export function PageContainer({
  className,
  width = "reading",
  as: Tag = "div",
  ...props
}: PageContainerProps) {
  return (
    <Tag
      className={cn("mx-auto w-full px-5 sm:px-6", widthClass[width], className)}
      {...props}
    />
  );
}

type PageHeaderProps = React.HTMLAttributes<HTMLElement> & {
  /** 左に出す小さな見出し。ページ名を置く */
  label?: React.ReactNode;
  /** 右端に置く操作（戻る・切り替えなど） */
  action?: React.ReactNode;
  width?: Width;
};

/**
 * 上に貼りつく見出し帯。地と同じクリームを透かして敷き、下端だけ暖色の罫で切る。
 * 白い面の上の罫（line）とは色が違うので、ここで間違えると濁って見える。
 */
export function PageHeader({
  className,
  label,
  action,
  width = "reading",
  children,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 border-b border-line-warm bg-nicchyo-base/90 py-4 backdrop-blur",
        className
      )}
      {...props}
    >
      <PageContainer width={width} className="flex items-center gap-3">
        {label ? (
          <p className="min-w-0 truncate text-sm font-medium text-nicchyo-ink/60">{label}</p>
        ) : null}
        {children}
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </PageContainer>
    </header>
  );
}

export type { Width as PageWidth };
