import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { lockBodyScroll, unlockBodyScroll, useBodyScrollLock } from "./bodyScrollLock";

describe("bodyScrollLock", () => {
  afterEach(() => {
    // テスト間で数が残らないよう、外しきる
    for (let i = 0; i < 10; i++) unlockBodyScroll();
  });

  it("2つ固定して1つ外しても固定のまま、もう1つ外すと外れる", () => {
    lockBodyScroll();
    lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    unlockBodyScroll();
    expect(document.body.style.overflow).toBe("");
  });

  it("多めに外しても数が0より下がらない（次の固定が効く）", () => {
    unlockBodyScroll();
    unlockBodyScroll();
    lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("useBodyScrollLock は描かれているあいだだけ固定し、重なっても最後が閉じるまで外さない", () => {
    const first = renderHook(() => useBodyScrollLock());
    const second = renderHook(() => useBodyScrollLock());
    expect(document.body.style.overflow).toBe("hidden");

    // 先に開いたほうを先に閉じても、後のほうが開いているあいだは固定のまま
    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    second.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("active が false のあいだは固定しない", () => {
    const { rerender, unmount } = renderHook(({ active }) => useBodyScrollLock(active), {
      initialProps: { active: false },
    });
    expect(document.body.style.overflow).toBe("");

    rerender({ active: true });
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
