import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VENDOR_TOUR_PAGES } from "@/lib/vendor/tours";
import TourDemo from "./TourDemo";
import { SCENES } from "./demo/scenes";

const SLIDES = VENDOR_TOUR_PAGES.flatMap((page) => page.features.flatMap((feature) => feature.slides));

afterEach(() => vi.useRealTimers());

describe("説明のデモ", () => {
  it("デモの工程の数と、スライドの字幕の数が合っている", () => {
    for (const slide of SLIDES) expect(slide.captions).toHaveLength(SCENES[slide.scene].steps);
  });

  it("使っていないデモが残っていない", () => {
    const used = new Set(SLIDES.map((slide) => slide.scene));
    for (const scene of Object.keys(SCENES)) expect(used.has(scene as keyof typeof SCENES)).toBe(true);
  });

  it("すべてのデモが、すべての工程で描ける", () => {
    for (const slide of SLIDES) {
      const { unmount } = render(<TourDemo slide={slide} />);
      for (let index = 0; index < slide.captions.length; index += 1) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(slide.captions[index]) }));
        expect(screen.getByRole("button", { name: new RegExp(slide.captions[index]) }).getAttribute("aria-current")).toBe("step");
      }
      unmount();
    }
  });

  it("工程は時間で順に進み、最後まで行ったら最初に戻る", () => {
    vi.useFakeTimers();
    const slide = SLIDES.find((item) => item.scene === "closed-day")!;
    render(<TourDemo slide={slide} />);
    const current = () =>
      slide.captions.findIndex((caption) =>
        screen.getByRole("button", { name: new RegExp(caption) }).getAttribute("aria-current") === "step"
      );

    expect(current()).toBe(0);
    act(() => void vi.advanceTimersByTime(2100));
    expect(current()).toBe(1);
    act(() => void vi.advanceTimersByTime(2100));
    expect(current()).toBe(2);
    act(() => void vi.advanceTimersByTime(3500));
    expect(current()).toBe(0);
  });

  it("字幕を押すと、その工程へ飛ぶ", () => {
    const slide = SLIDES.find((item) => item.scene === "chat-hours")!;
    render(<TourDemo slide={slide} />);

    fireEvent.click(screen.getByRole("button", { name: /変更案が出る/ }));

    expect(screen.getByRole("button", { name: /変更案が出る/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: /言葉にして送る/ }).getAttribute("aria-current")).toBeNull();
  });
});
