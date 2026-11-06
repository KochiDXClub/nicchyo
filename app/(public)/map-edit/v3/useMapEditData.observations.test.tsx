import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMapEditData } from "./useMapEditData";

afterEach(() => vi.unstubAllGlobals());
describe("現場位置を取得できない場合", () => {
  it("地図データを維持し、補助情報が欠けていることを示す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ shops: [], vendors: [{ id: "v", name: "店" }], roads: [], landmarks: [], fieldObservationsUnavailable: true }), { status: 200 })));
    const { result } = renderHook(() => useMapEditData({ changes: [] }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fieldObservationsUnavailable).toBe(true);
    expect(result.current.vendors).toMatchObject([{ id: "v" }]);
  });
});
