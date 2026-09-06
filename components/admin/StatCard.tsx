import React from "react";
import type { LucideIcon } from "lucide-react";

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
  bgColor = "bg-white border border-slate-200",
  textColor = "text-slate-900",
}: StatCardProps) {
  const isComponentIcon = typeof icon !== "string";
  const Icon = isComponentIcon ? (icon as LucideIcon) : null;

  return (
    <div className={`${bgColor} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-500">{title}</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${textColor}`}>{value}</p>
        </div>
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        ) : (
          <span className="text-3xl" aria-hidden="true">
            {icon as string}
          </span>
        )}
      </div>
    </div>
  );
});
