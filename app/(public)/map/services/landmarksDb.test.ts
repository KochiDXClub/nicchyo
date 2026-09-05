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
        // スポット用の列が無い行は既定値で埋める
        category: undefined,
        transitMode: undefined,
        lines: [],
        tags: [],
        notes: undefined,
        externalUrl: undefined,
        photoUrl: undefined,
        photoCredit: undefined,
        openFrom: undefined,
        openUntil: undefined,
        showOnMap: true,
        // verified 列が無い行は「未確認」と断定しない
        verified: undefined,
      },
    ]);
  });

  it("スポット用の列（category・写真・タグなど）を引き継ぐ", async () => {
    const supabase = makeSupabase({
      data: [
        {
          key: "tram-harimayabashi",
          name: "はりまや橋停留場",
          description: "説明",
          image_url: "/tram.svg",
          latitude: 33.5596,
          longitude: 133.5424,
          width_px: 40,
          height_px: 40,
          show_at_min_zoom: true,
          category: "transit",
          transit_mode: "tram",
          lines: ["伊野線"],
          tags: ["屋根あり"],
          notes: "補足",
          external_url: "https://example.com/timetable",
          photo_url: "https://example.com/photo.jpg",
          photo_credit: "写真: someone",
          open_from: "06:00",
          open_until: "23:00",
          show_on_map: false,
          verified: true,
        },
      ],
    });

    const [result] = await fetchLandmarksFromDb(supabase);

    expect(result.category).toBe("transit");
    expect(result.transitMode).toBe("tram");
    expect(result.lines).toEqual(["伊野線"]);
    expect(result.tags).toEqual(["屋根あり"]);
    expect(result.notes).toBe("補足");
    expect(result.externalUrl).toBe("https://example.com/timetable");
    expect(result.photoUrl).toBe("https://example.com/photo.jpg");
    expect(result.photoCredit).toBe("写真: someone");
    expect(result.openFrom).toBe("06:00");
    expect(result.openUntil).toBe("23:00");
    expect(result.showOnMap).toBe(false);
    expect(result.verified).toBe(true);
  });

  it("スポット用の列が無い環境では基本列だけで取り直す", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "column map_landmarks.category does not exist" } })
      .mockResolvedValueOnce({
        data: [
          {
            key: "castle",
            name: "高知城",
            description: "",
            image_url: "/castle.png",
            latitude: 33.56,
            longitude: 133.53,
            width_px: 80,
            height_px: 60,
            show_at_min_zoom: true,
          },
        ],
        error: null,
      });
    const select = vi.fn().mockReturnValue({ order });
    const supabase = { from: vi.fn().mockReturnValue({ select }) } as unknown as Parameters<
      typeof fetchLandmarksFromDb
    >[0];

    const result = await fetchLandmarksFromDb(supabase);

    expect(select).toHaveBeenCalledTimes(2);
    expect(select.mock.calls[1][0]).not.toContain("category");
    expect(result.map((l) => l.key)).toEqual(["castle"]);
    expect(result[0].category).toBeUndefined();
    consoleWarnSpy.mockRestore();
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
