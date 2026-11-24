import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAdminMarketDays } from "./useAdminMarketDays";

vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

it("別の日のアップロードが完了しても、進行中の日は保存せず画像の下書きを保持する", async () => {
  const firstDate = "2026-11-22";
  const secondDate = "2026-11-29";
  const imageUrl = "/market-events/new.webp";
  const first = Promise.withResolvers<Response>();
  const second = Promise.withResolvers<Response>();
  const fetchMock = vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({ days: [] }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useAdminMarketDays({ enabled: false }));
  const image = new File(["image"], "example.webp", { type: "image/webp" });

  act(() => {
    void result.current.uploadImage(firstDate, image);
    void result.current.save(firstDate, "cancelled", "荒天");
    void result.current.uploadImage(secondDate, image);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.isUploadingImage(firstDate)).toBe(true);
  expect(result.current.isUploadingImage(secondDate)).toBe(true);

  await act(async () => second.resolve(Response.json({ url: "/market-events/other.webp" })));
  expect(result.current.isUploadingImage(secondDate)).toBe(false);
  expect(result.current.isUploadingImage(firstDate)).toBe(true);
  await act(() => result.current.save(firstDate, "cancelled", "荒天"));
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await act(async () => first.resolve(Response.json({ url: imageUrl })));
  expect(result.current.imageDraftFor(firstDate)).toBe(imageUrl);
  await act(() => result.current.save(firstDate, "cancelled", "荒天", result.current.imageDraftFor(firstDate)));
  expect(fetchMock).toHaveBeenNthCalledWith(
    3, "/api/admin/market-days",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ market_date: firstDate, status: "cancelled", note: "荒天", image_url: imageUrl }),
    }),
  );
  expect(result.current.imageDraftFor(secondDate)).toBe("/market-events/other.webp");
});
