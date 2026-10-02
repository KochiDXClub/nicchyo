"use client";

import { CircleHelp } from "lucide-react";
import { requestOpenVendorTour } from "@/lib/vendor/tourEvents";
import { findVendorTourFeature } from "@/lib/vendor/tours";
import { cn } from "@/lib/utils/cn";

/**
 * 画面の中の、ひとつの機能の説明を開く小さな「?」。機能の見出しの横に置く。
 * 開くのは VendorTourHost（レイアウトにある）。画面にホストが無い所では何も起きない。
 * key は lib/vendor/tours.ts の機能の key。
 */
export default function FeatureHelpButton({ tourKey, className }: { tourKey: string; className?: string }) {
  const feature = findVendorTourFeature(tourKey);
  if (!feature) return null;

  return (
    <button
      type="button"
      onClick={() => requestOpenVendorTour(tourKey)}
      aria-label={`「${feature.name}」の説明を見る`}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-amber-600 shadow-chip ring-1 ring-line transition hover:bg-amber-50 active:scale-95 motion-reduce:active:scale-100",
        className
      )}
    >
      <CircleHelp size={18} aria-hidden="true" />
    </button>
  );
}
