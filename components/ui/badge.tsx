import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive" | "favorite" | "ai" | "search" | "amber";
};

const badgeVariantClassMap: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default:     "border-transparent bg-slate-700 text-white",
  secondary:   "border-transparent bg-slate-100 text-slate-700",
  outline:     "border bg-white text-slate-700",
  destructive: "border-transparent bg-rose-100 text-rose-700",
  favorite:    "border-favorite-line bg-favorite-bg text-favorite-fg",
  ai:          "border-ai-line bg-ai-bg text-ai-fg",
  search:      "border-info-line bg-info-bg text-info-fg",
  amber:       "border-amber-200 bg-amber-50 text-amber-800",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeVariantClassMap[variant],
        className
      )}
      {...props}
    />
  );
}
