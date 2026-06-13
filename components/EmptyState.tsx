import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  variant?: "amber" | "pink" | "sky" | "slate";
};

const VARIANT_STYLES = {
  amber: {
    container: "border-amber-200 bg-amber-50/30",
    iconWrapper: "text-amber-500 border-amber-100",
    title: "text-gray-900",
    description: "text-gray-600",
  },
  pink: {
    container: "border-pink-200 bg-pink-50/50",
    iconWrapper: "text-pink-400 border-pink-100",
    title: "text-pink-900",
    description: "text-pink-700",
  },
  sky: {
    container: "border-sky-200 bg-sky-50/50",
    iconWrapper: "text-sky-400 border-sky-100",
    title: "text-sky-900",
    description: "text-sky-700",
  },
  slate: {
    container: "border-slate-200 bg-slate-50",
    iconWrapper: "text-slate-500 border-slate-100",
    title: "text-slate-800",
    description: "text-slate-600",
  },
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = "amber",
}: EmptyStateProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center",
        styles.container,
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border",
          styles.iconWrapper
        )}
      >
        <Icon size={32} className="text-current" />
      </div>
      <h3 className={cn("mb-2 text-lg font-bold", styles.title)}>{title}</h3>
      <div className={cn("mb-6 max-w-sm text-sm leading-relaxed", styles.description)}>
        {description}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row items-center justify-center w-full">
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}
