import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface EmptyMessageProps {
  /** 表示する文言（例: 「投稿がありません」） */
  message: string;
  /** 上下の余白（Tailwindのpy-*クラス） */
  padding?: string;
  /** メッセージの下に添えるリンクやボタンなど */
  action?: ReactNode;
  className?: string;
}

/**
 * 一覧が空のときに中央寄せでメッセージだけを表示する定型パターン。
 * アイコンや見出しが必要な場合は components/admin/EmptyState.tsx を使う。
 */
export function EmptyMessage({ message, padding = "py-8", action, className }: EmptyMessageProps) {
  return (
    <div className={cn(padding, "text-center", className)}>
      <p className="text-sm text-slate-400">{message}</p>
      {action}
    </div>
  );
}
