import { describe, it, expect, vi } from "vitest";
import { fetchLandmarksFromDb } from "./landmarksDb";

const makeSupabase = (result: { data?: unknown[]; error?: { message: string } | null }) => {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: result.data ?? null,
          error: result.error ?? null,
        }),
      }),
    }),
  } as unknown as Parameters<typeof fetchLandmarksFromDb>[0];
};

describe("fetchLandmarksFromDb", () => {
  it("正常時は行をLandmarkに変換して返す", async () => {
    const supabase = makeSupabase({
      data: [
        {
          key: "landmark-1",
          name: "高知城",
          description: "説明",
          image_url: "https://example.com/image.png",
          latitude: 33.56,
          longitude: 133.53,
          width_px: 100,
          height_px: 80,
          show_at_min_zoom: true,
        },
      ],
    });

    const result = await fetchLandmarksFromDb(supabase);

    expect(result).toEqual([
      {
        key: "landmark-1",
        name: "高知城",
        description: "説明",
        url: "https://example.com/image.png",
        lat: 33.56,
        lng: 133.53,
        widthPx: 100,
        heightPx: 80,
        showAtMinZoom: true,
      },
    ]);
  });

  it("必須項目が欠けている行は除外する", async () => {
    const supabase = makeSupabase({
      data: [
        {
          key: "landmark-broken",
          name: null,
          description: null,
          image_url: "https://example.com/image.png",
          latitude: 33.56,
          longitude: 133.53,
          width_px: 100,
          height_px: 80,
          show_at_min_zoom: false,
        },
      ],
    });

    const result = await fetchLandmarksFromDb(supabase);

    expect(result).toEqual([]);
  });

  it("取得エラー時は例外を投げず空配列を返す（他のマップデータ表示を巻き込まないため）", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = makeSupabase({ error: { message: "permission denied for table map_landmarks" } });

    const result = await fetchLandmarksFromDb(supabase);

    expect(result).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[fetchLandmarksFromDb] failed:",
      "permission denied for table map_landmarks"
    );

    consoleWarnSpy.mockRestore();
  });
});
