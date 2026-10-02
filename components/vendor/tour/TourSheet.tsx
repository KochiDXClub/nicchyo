"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { VendorTour } from "@/lib/vendor/tours";
import VendorSheet from "../VendorSheet";
import TourIllustration from "./TourIllustration";

/**
 * 画面の説明パネル。2〜3枚を「次へ」で送り、最後は「了解した」で閉じる。
 * 途中で閉じる（背景を押す・Esc）のは「了解した」とは違うので、見たことには数えない。
 */
export default function TourSheet({
  tour,
  onAcknowledge,
  onDismiss,
}: {
  tour: VendorTour;
  /** 最後の「了解した」。見たことを記録する */
  onAcknowledge: () => void;
  /** 途中で閉じる。記録しない（次に開いたときも自動で出る） */
  onDismiss: () => void;
}) {
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const slide = tour.slides[index];
  const isLast = index === tour.slides.length - 1;

  return (
    <VendorSheet labelledBy={titleId} focusKey={index} onClose={onDismiss}>
      <div className="space-y-4 px-5 pb-2 pt-4">
        <p className="text-xs font-bold text-nicchyo-ink/55">{tour.screenName}</p>
        <TourIllustration scene={slide.scene} />
        <div>
          <h2 id={titleId} className="text-lg font-bold leading-snug text-nicchyo-ink">
            {slide.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-nicchyo-ink/70">{slide.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <ol className="flex gap-1.5" aria-label={`${index + 1} / ${tour.slides.length}`}>
            {tour.slides.map((item, i) => (
              <li
                key={item.title}
                aria-hidden="true"
                className={cn("h-2 rounded-full transition-all ease-out-soft", i === index ? "w-6 bg-amber-500" : "w-2 bg-nicchyo-ink/15")}
              />
            ))}
          </ol>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="quiet" onClick={() => setIndex(index - 1)}>
                戻る
              </Button>
            )}
            {isLast ? (
              <Button onClick={onAcknowledge}>了解した</Button>
            ) : (
              <Button onClick={() => setIndex(index + 1)}>次へ</Button>
            )}
          </div>
        </div>
      </div>
    </VendorSheet>
  );
}
