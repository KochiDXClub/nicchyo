import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

/**
 * ぐるぐる回転するローディングアイコン単体。
 * ボタン内など、独自にレイアウトしたい箇所ではこちらを直接使う。
 */
export function LoadingSpinner({ size = 28, className }: LoadingSpinnerProps) {
  return (
    <Loader2
      size={size}
      className={cn("animate-spin text-amber-500", className)}
      aria-hidden="true"
    />
  );
}

interface CenteredLoadingProps extends LoadingSpinnerProps {
  /** 上下の余白（Tailwindのpy-*クラス） */
  padding?: string;
}

/**
 * 「読み込み中は中央にスピナーだけを表示する」定型パターンをまとめたもの。
 * 例: {isLoading ? <CenteredLoading /> : <Content />}
 */
export function CenteredLoading({ size, className, padding = "py-12" }: CenteredLoadingProps) {
  return (
    <div className={cn("flex justify-center", padding)}>
      <LoadingSpinner size={size} className={className} />
    </div>
  );
}
