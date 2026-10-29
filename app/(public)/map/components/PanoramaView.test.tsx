import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanoramaView } from "./PanoramaView";

describe("PanoramaView", () => {
  it("横にドラッグすると、ドラッグした分だけ画像の位置が動く", () => {
    render(<PanoramaView src="https://example.supabase.co/p.webp" alt="店の写真" />);
    const view = screen.getByRole("img");

    fireEvent.pointerDown(view, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(view, { clientX: 160, pointerId: 1 });
    fireEvent.pointerUp(view, { pointerId: 1 });
    expect(view.style.backgroundPosition).toContain("60px");

    // 指を離したあとに動かしても、位置は変わらない
    fireEvent.pointerMove(view, { clientX: 300, pointerId: 1 });
    expect(view.style.backgroundPosition).toContain("60px");
  });
});
