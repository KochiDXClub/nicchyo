import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
// 全周の表示（Photo Sphere Viewer）は WebGL を使うので、jsdom では動かない。外側の枠（PanoramaView）だけを確かめる
vi.mock("./PanoramaSphere", () => ({ default: () => null }));

import { ShopPhotoViewer, type ShopPhoto } from "./ShopPhotoViewer";

const PHOTOS: ShopPhoto[] = [
  { src: "https://example.supabase.co/a.webp", alt: "店の写真", caption: "山田農園" },
  { src: "https://example.supabase.co/b.webp", alt: "トマトの写真", caption: "トマト　¥300" },
];

/** 写真のボタンを押すと拡大表示が開く、バナーと同じ形 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        トマトの写真を大きく見る
      </button>
      <button type="button">裏のボタン</button>
      {open && <ShopPhotoViewer photos={PHOTOS} initialIndex={1} onClose={() => setOpen(false)} />}
    </>
  );
}

function openViewer() {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "トマトの写真を大きく見る" });
  trigger.focus();
  act(() => trigger.click());
  return trigger;
}

describe("ShopPhotoViewer", () => {
  it("開くと閉じるボタンに focus が移り、その写真の説明を出す", () => {
    openViewer();

    expect(screen.getByRole("dialog", { name: "写真の拡大表示" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "閉じる" }));
    // getByText は空白を詰めて比べるので、全角の空白は半角1つになる
    expect(screen.getByText("トマト ¥300")).toBeTruthy();
  });

  it("閉じると、押した写真のボタンに focus が戻る", () => {
    const trigger = openViewer();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  // jsdom は Tab で focus を動かさないので、拡大表示の中で回していること（既定の動きを止めていること）を見る
  it("Tab で拡大表示の中のボタンを回り、外（裏のバナー）に抜けない", () => {
    openViewer();
    const close = screen.getByRole("button", { name: "閉じる" });
    // 2枚目を開いているので「次の写真」は押せない。押せるのは「閉じる」と「前の写真」
    const previous = screen.getByRole("button", { name: "前の写真" });

    expect(fireEvent.keyDown(window, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(previous);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    expect(fireEvent.keyDown(window, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(previous);
  });

  it("Tab は、今見ている全周写真（矢印キーで見渡せる）にも止まる。見ていない全周写真には止まらない", async () => {
    const panoramas: ShopPhoto[] = [
      { src: "https://example.supabase.co/p1.webp", alt: "全周A" },
      { src: "https://example.supabase.co/p2.webp", alt: "全周B" },
    ];
    render(<ShopPhotoViewer photos={panoramas} initialIndex={0} onClose={() => {}} />);
    // 読み込んだ大きさが 2:1 の写真は、全周写真として見渡す表示になる
    await act(async () => {
      for (const image of screen.getAllByRole("img", { hidden: true })) {
        Object.defineProperty(image, "naturalWidth", { value: 2000 });
        Object.defineProperty(image, "naturalHeight", { value: 1000 });
        fireEvent.load(image);
      }
    });

    const stops = new Set<string | null>();
    for (let i = 0; i < 6; i += 1) {
      fireEvent.keyDown(window, { key: "Tab" });
      stops.add(document.activeElement?.getAttribute("aria-label") ?? null);
    }

    expect([...stops].some((label) => label?.startsWith("全周A"))).toBe(true);
    expect([...stops].some((label) => label?.startsWith("全周B"))).toBe(false);
  });
});
