"use client";

import { Building2, Store, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { VendorInquiryCategory } from "@/lib/vendorInquiries/constants";
import { CATEGORY_CHOICES, CATEGORY_GUIDES } from "@/lib/vendorInquiries/labels";
import { cn } from "@/lib/utils/cn";

const CATEGORY_ICONS: Record<VendorInquiryCategory, LucideIcon> = {
  operator: Store,
  city: Building2,
  both: Users,
};

/**
 * 新しい連絡の最初に「どこへ連絡するか」を選ぶ。
 * 用件（質問・報告・相談）より先に宛先を決めてもらい、送り先を出店者が自分で分かって送れるようにする。
 */
export default function InquiryDestinationPicker({
  value,
  onChange,
}: {
  value: VendorInquiryCategory | null;
  onChange: (category: VendorInquiryCategory) => void;
}) {
  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="text-base font-semibold text-nicchyo-ink">どこに連絡しますか？</h2>
      <p className="mt-1 text-xs text-nicchyo-ink/55">あとから選び直せます。迷ったら「両方」を選んでください。</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label="連絡する宛先">
        {CATEGORY_CHOICES.map((c) => {
          const guide = CATEGORY_GUIDES[c];
          const Icon = CATEGORY_ICONS[c];
          const selected = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={selected}
              className={cn(
                "flex items-start gap-3 rounded-btn px-3 py-3 text-left ring-1 transition sm:flex-col sm:gap-1",
                selected
                  ? "bg-amber-50 shadow-chip ring-amber-300"
                  : "bg-white ring-line hover:bg-amber-50/50 hover:ring-amber-200"
              )}
            >
              <Icon
                size={20}
                aria-hidden="true"
                className={cn("mt-0.5 shrink-0", selected ? "text-amber-600" : "text-nicchyo-ink/40")}
              />
              <span>
                <span className="block text-sm font-bold text-nicchyo-ink">{guide.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-nicchyo-ink/70">{guide.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
