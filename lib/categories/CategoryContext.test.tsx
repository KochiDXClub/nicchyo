import { render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryProvider, useCategorizedShop, useCategoryFilter } from "./CategoryContext";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => { const router = { refresh }; return { useRouter: () => router }; });
const shop = { categoryId: "c1", category: "食材" };
function Consumer() {
  const current = useCategorizedShop(shop);
  const [filter] = useCategoryFilter("c1");
  return <><span data-testid="banner">{current.category}</span><span data-testid="filter">{filter}</span></>;
}
describe("表示中のマップ・バナーと絞り込み", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("取得後の改名とフォーカス復帰で同じ選択IDのまま表示が追従する", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ categories: [{ id: "c1", name: "野菜・果物", presentation_key: "食材" }] }) });
    vi.stubGlobal("fetch", fetcher);
    render(<CategoryProvider initial={[{ id: "c1", name: "食材", presentation_key: "食材" }]}><Consumer /></CategoryProvider>);
    await waitFor(() => expect(screen.getByTestId("banner").textContent).toBe("野菜・果物"));
    expect(screen.getByTestId("filter").textContent).toBe("野菜・果物");
    expect(refresh).toHaveBeenCalled();
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ categories: [{ id: "c1", name: "青果", presentation_key: "食材" }] }) });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(screen.getByTestId("banner").textContent).toBe("青果"));
    expect(screen.getByTestId("filter").textContent).toBe("青果");
  });
  it("通信失敗でカテゴリや店舗表示を消さない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<CategoryProvider initial={[{ id: "c1", name: "野菜・果物", presentation_key: "食材" }]}><Consumer /></CategoryProvider>);
    expect(screen.getByTestId("banner").textContent).toBe("野菜・果物");
  });
  it("初回一覧が空でもURLのカテゴリを保持し、再取得後に名前を解決する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ categories: [{ id: "c1", name: "野菜・果物", presentation_key: "食材" }] }) }));
    render(<CategoryProvider initial={[]}><Consumer /></CategoryProvider>);
    await waitFor(() => expect(screen.getByTestId("filter").textContent).toBe("野菜・果物"));
  });
});

it("改名前から選択しているカテゴリで、改名後も同じ店舗を絞り込める", async () => {
  const { useMapSearchFilter } = await import("@/app/(public)/map/hooks/useMapSearchFilter");
  const { useCategorizedShops } = await import("./CategoryContext");
  const source = [{ id: 1, name: "農園", category: "食材", categoryId: "c1", products: [] }, { id: 2, name: "惣菜", category: "食べ物", products: [] }].map((shop, i) => ({ ownerName: "", description: "", schedule: "", position: i, lat: 33.56, lng: 133.53, ...shop }));
  function MapFilter() {
    const shops = useCategorizedShops(source);
    const filter = useMapSearchFilter({ shops, favoriteShopIds: [], initialCategory: "c1" });
    return <div data-testid="results">{filter.category}:{filter.results.map(s => s.id).join(",")}</div>;
  }
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ categories: [{ id: "c1", name: "野菜・果物", presentation_key: "食材" }] }) }));
  try {
    render(<CategoryProvider initial={[{ id: "c1", name: "食材", presentation_key: "食材" }]}><MapFilter /></CategoryProvider>);
    await waitFor(() => expect(screen.getByTestId("results").textContent).toBe("野菜・果物:1"));
  } finally { vi.unstubAllGlobals(); }
});
