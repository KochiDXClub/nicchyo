import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Photo Sphere Viewer は WebGL を使うので、jsdom では動かない。viewer の代わりに、呼ばれ方を確かめられる偽物を渡す
const viewer = vi.hoisted(() => ({
  getPosition: vi.fn(() => ({ yaw: 0, pitch: 0 })),
  rotate: vi.fn(),
}));
const sphereProps = vi.hoisted(() => ({ src: "" }));
vi.mock("./PanoramaSphere", async () => {
  const { useEffect } = await import("react");
  return {
    default: function FakeSphere({ src, onReady }: { src: string; onReady: (v: unknown) => void }) {
      sphereProps.src = src;
      useEffect(() => {
        onReady(viewer);
        return () => onReady(null);
      }, [onReady]);
      return <div data-testid="sphere" />;
    },
  };
});

import { PanoramaView } from "./PanoramaView";

async function renderView() {
  render(<PanoramaView src="https://example.supabase.co/p.webp" alt="店の写真" />);
  await waitFor(() => expect(screen.getByTestId("sphere")).toBeTruthy());
  return screen.getByRole("application");
}

describe("PanoramaView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("読み上げの名前に、写真の説明と見渡せることを入れる", async () => {
    const view = await renderView();
    expect(view.getAttribute("aria-label")).toBe("店の写真（360度。ドラッグして見渡せます）");
  });

  it("画像は、同じ配信元の縮小版（next/image）を読む", async () => {
    await renderView();
    expect(sphereProps.src).toContain("/_next/image");
    expect(sphereProps.src).toContain(encodeURIComponent("https://example.supabase.co/p.webp"));
  });

  it("矢印キーで見渡す。外側の横スクロール（写真の切り替え）は動かさない", async () => {
    const view = await renderView();

    // fireEvent は、既定の動きが止められたとき false を返す
    expect(fireEvent.keyDown(view, { key: "ArrowRight" })).toBe(false);
    expect(viewer.rotate).toHaveBeenLastCalledWith({ yaw: 0.1, pitch: 0 });

    expect(fireEvent.keyDown(view, { key: "ArrowLeft" })).toBe(false);
    expect(viewer.rotate).toHaveBeenLastCalledWith({ yaw: -0.1, pitch: 0 });

    expect(fireEvent.keyDown(view, { key: "ArrowUp" })).toBe(false);
    expect(viewer.rotate).toHaveBeenLastCalledWith({ yaw: 0, pitch: 0.1 });
  });

  it("真上・真下より先には回らない", async () => {
    viewer.getPosition.mockReturnValue({ yaw: 0, pitch: Math.PI / 2 - 0.01 });
    const view = await renderView();

    fireEvent.keyDown(view, { key: "ArrowUp" });

    expect(viewer.rotate).toHaveBeenLastCalledWith({ yaw: 0, pitch: Math.PI / 2 });
  });

  it("矢印以外のキーは、何もせず通す（Tab や Esc は親が受ける）", async () => {
    const view = await renderView();

    expect(fireEvent.keyDown(view, { key: "Tab" })).toBe(true);
    expect(viewer.rotate).not.toHaveBeenCalled();
  });
});
