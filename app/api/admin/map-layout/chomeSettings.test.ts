import { describe, expect, it } from "vitest";
import { loadChomeSettings } from "./chomeSettings";

type Result = { data: unknown[] | null; error: { code: string } | null };

/** from(テーブル名) → select → (order) の順に呼ばれる Supabase クライアントの代わり */
function fakeSupabase(results: Record<string, Result>) {
  return {
    from: (table: string) => {
      const result = results[table];
      const chain = { order: () => Promise.resolve(result), then: (resolve: (r: Result) => unknown) => resolve(result) };
      return { select: () => chain };
    },
  } as never;
}

const boundaryRow = { id: "B1", name: "廿代通り", latitude: 33.5, longitude: 133.5, confidence: "needs_review" };
const sectionRow = { chome_id: 2, road_id: "main", from_boundary_id: "B1", to_boundary_id: null };

describe("loadChomeSettings", () => {
  it("境目と区間を読む", async () => {
    const result = await loadChomeSettings(
      fakeSupabase({
        chome_boundaries: { data: [boundaryRow], error: null },
        chome_sections: { data: [sectionRow], error: null },
      })
    );
    expect(result.boundaries).toEqual([{ id: "B1", name: "廿代通り", lat: 33.5, lng: 133.5, confidence: "needs_review" }]);
    expect(result.sections).toEqual([{ chomeId: 2, roadId: "main", fromBoundaryId: "B1", toBoundaryId: null }]);
  });

  it.each(["42P01", "PGRST205"])("テーブルが無いとき（%s）は空で返し、画面が開けなくならない", async (code) => {
    const missing: Result = { data: null, error: { code } };
    expect(await loadChomeSettings(fakeSupabase({ chome_boundaries: missing, chome_sections: missing }))).toEqual({
      boundaries: [],
      sections: [],
    });
  });

  it("ほかのエラーは投げる", async () => {
    const broken: Result = { data: null, error: { code: "XX000" } };
    await expect(
      loadChomeSettings(fakeSupabase({ chome_boundaries: broken, chome_sections: { data: [], error: null } }))
    ).rejects.toThrow("Failed to load chome settings");
  });
});
