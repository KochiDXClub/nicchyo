import React from "react";
import type { LucideIcon } from "lucide-react";
import { Surface } from "@/components/ui";

interface StatCardProps {
  title: string;
  value: string | number;
  /** lucide のアイコンを推奨。文字列（絵文字）は既存画面との互換のため残している */
  icon: LucideIcon | string;
  bgColor?: string;
  textColor?: string;
}

export const StatCard = React.memo(function StatCard({
  title,
  value,
  icon,
  bgColor,
  textColor = "text-nicchyo-ink",
}: StatCardProps) {
  const isComponentIcon = typeof icon !== "string";
  const Icon = isComponentIcon ? (icon as LucideIcon) : null;

  return (
    <Surface padding="none" className={`p-5 ${bgColor ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-nicchyo-ink/55">{title}</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${textColor}`}>{value}</p>
        </div>
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-nicchyo-ink/5 text-nicchyo-ink/55">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        ) : (
          <span className="text-3xl" aria-hidden="true">
            {icon as string}
          </span>
        )}
      </div>
    </Surface>
  );
});
