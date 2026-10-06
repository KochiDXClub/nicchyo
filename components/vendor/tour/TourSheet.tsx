"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { TourFeature } from "@/lib/vendor/tours";
import VendorSheet from "../VendorSheet";
import TourDemo from "./TourDemo";

/**
 * 画面の説明パネル。機能ごとのスライドを順に「次へ」で送り、最後は「了解した」で閉じる。
 * 途中で閉じる（背景を押す・Esc）のは「了解した」とは違うので、見たことには数えない。
 */
export default function TourSheet({
  screenName,
  showFeatureName,
  features,
  onAcknowledge,
  onDismiss,
}: {
  screenName: string;
  /** その画面に機能が複数あるとき true。いま見ている機能の名前を、画面の名前に添える */
  showFeatureName: boolean;
  features: readonly TourFeature[];
  /** 最後の「了解した」。ここにある機能を見たこととして記録する */
  onAcknowledge: () => void;
  /** 途中で閉じる。記録しない（次に開いたときも自動で出る） */
  onDismiss: () => void;
}) {
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const slides = useMemo(
    () => features.flatMap((feature) => feature.slides.map((slide) => ({ feature, slide }))),
    [features]
  );
  const { feature, slide } = slides[index];
  const isLast = index === slides.length - 1;
  const heading = showFeatureName ? `${screenName} ／ ${feature.name}` : screenName;

  return (
    <VendorSheet labelledBy={titleId} focusKey={index} onClose={onDismiss}>
      <div className="space-y-4 px-5 pb-2 pt-4">
        <p className="text-xs font-bold text-nicchyo-ink/55">{heading}</p>
        <TourDemo key={`${feature.key}-${index}`} slide={slide} />
        <div>
          <h2 id={titleId} className="text-lg font-bold leading-snug text-nicchyo-ink">
            {slide.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-nicchyo-ink/70">{slide.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <ol className="flex gap-1.5" aria-label={`${index + 1} / ${slides.length}`}>
            {slides.map((item, i) => (
              <li
                key={`${item.feature.key}-${i}`}
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
              <Button data-autofocus onClick={onAcknowledge}>了解した</Button>
            ) : (
              <Button data-autofocus onClick={() => setIndex(index + 1)}>次へ</Button>
            )}
          </div>
        </div>
      </div>
    </VendorSheet>
  );
}
