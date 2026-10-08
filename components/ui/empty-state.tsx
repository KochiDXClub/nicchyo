import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * 何も無いときの表示。
 *
 * もとは 3 つ（components/EmptyState、components/admin/EmptyState、
 * components/ui/empty-message）に割れていて、絵文字か lucide か、
 * 枠が破線か無しか、ボタンが amber か blue かが場所ごとに違っていた。
 * ここに寄せる。
 *
 * 一行の文言を出したいだけなら EmptyMessage（empty-message.tsx）で足りる。
 */
type EmptyStateProps = {
  /** lucide のアイコン、または絵文字の文字列。省略すると図は出ない */
  icon?: LucideIcon | string;
  title: string;
  description?: React.ReactNode;
  /** ボタンなど。Button を渡す */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** amber=主色の空状態（既定）。neutral=管理画面など、色を足したくないとき */
  tone?: "amber" | "neutral";
  /** 破線の枠で囲む。一覧の中に置くときは付けたほうが境目が分かる */
  bordered?: boolean;
  className?: string;
};

const toneClass = {
  amber: {
    frame: "border-amber-200 bg-amber-50/30",
    icon: "ring-amber-100 text-amber-500",
    description: "text-nicchyo-ink/60",
  },
  neutral: {
    frame: "border-line bg-white",
    icon: "ring-line text-nicchyo-ink/40",
    description: "text-nicchyo-ink/55",
  },
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tone = "amber",
  bordered = true,
  className,
}: EmptyStateProps) {
  const styles = toneClass[tone];
  const isEmoji = typeof icon === "string";
  const Icon = isEmoji ? null : (icon as LucideIcon | undefined);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        bordered && cn("rounded-card border-2 border-dashed", styles.frame),
        className
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-chip bg-white shadow-card ring-1",
            styles.icon
          )}
        >
          {isEmoji ? (
            <span className="text-3xl leading-none" aria-hidden="true">
              {icon as string}
            </span>
          ) : Icon ? (
            <Icon size={32} aria-hidden="true" />
          ) : null}
        </div>
      ) : null}

      <h3 className="text-lg font-bold text-nicchyo-ink">{title}</h3>

      {description ? (
        <div className={cn("mt-2 max-w-sm text-sm leading-relaxed", styles.description)}>
          {description}
        </div>
      ) : null}

      {action || secondaryAction ? (
        <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export type { EmptyStateProps };
