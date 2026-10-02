"use client";

import { cn } from "@/lib/utils/cn";
import type { TourSlide } from "@/lib/vendor/tours";
import { DemoStage } from "./demo/primitives";
import { SCENES } from "./demo/scenes";
import { useDemoStep } from "./demo/useDemoStep";

/**
 * スライドの「動くデモ」。舞台の絵が工程を順に進み、下の字幕が、いま動いている工程を強調する。
 * 字幕を押すと、その工程へ飛べる（「動きを減らす」設定のときは、ここで順に見る）。
 * スライドが変わるときは key を変えて作り直し、工程を最初に戻す。
 */
export default function TourDemo({ slide }: { slide: TourSlide }) {
  const scene = SCENES[slide.scene];
  const { step, select } = useDemoStep(scene.steps);

  return (
    <div className="space-y-3">
      <DemoStage>{scene.render({ step })}</DemoStage>
      <ol className="space-y-1">
        {slide.captions.map((caption, index) => {
          const active = index === step;
          return (
            <li key={caption}>
              <button
                type="button"
                onClick={() => select(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-btn px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors duration-300",
                  active ? "bg-amber-100 font-bold text-nicchyo-ink" : "text-nicchyo-ink/55 hover:bg-amber-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-300",
                    active ? "bg-amber-500 text-white" : "bg-nicchyo-ink/10 text-nicchyo-ink/55"
                  )}
                >
                  {index + 1}
                </span>
                {caption}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
