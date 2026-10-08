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
  style,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 border-b border-line-warm bg-nicchyo-base/90 pb-4 backdrop-blur",
        className
      )}
      // 上端に貼りつくので、切り欠きぶんは自分で避ける
      style={{ paddingTop: "calc(1rem + var(--safe-top, 0px))", ...style }}
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

type PageTitleProps = {
  title: React.ReactNode;
  /** 右端に置く操作や札（新規投稿・未保存など）。戻る操作は置かない */
  action?: React.ReactNode;
  width?: Width;
  className?: string;
  /** 見出しの下に続けて置くもの（タブなど） */
  children?: React.ReactNode;
};

/**
 * ページの見出し。地から中身に移る手前に主色を薄く敷いて、視線の入口を作る。
 *
 * 貼りつかない（PageHeader と違ってスクロールで流れる）。戻る操作は置かない：
 * どの画面にも下に NavigationBar があり、そこから戻れるので、左上に戻るボタンを
 * 足すと出口が二つになる。来訪者向けの FAQ・カレンダーと同じ形で、出店者ページの
 * 見出しもこれに揃える。
 */
export function PageTitle({ title, action, width = "reading", className, children }: PageTitleProps) {
  return (
    <div className={cn("bg-gradient-to-b from-amber-100/50 to-transparent pb-6 pt-safe-top", className)}>
      <PageContainer width={width} className="pt-6">
        <div className="flex items-center gap-3 pr-[var(--page-title-end-gap,0px)]">
          <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{title}</h1>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {children}
      </PageContainer>
    </div>
  );
}

export type { Width as PageWidth };
