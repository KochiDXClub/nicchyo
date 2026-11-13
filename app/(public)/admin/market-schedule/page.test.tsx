import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions: { isAdmin: true }, isLoading: false }) }));
vi.mock("@/components/admin", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>, AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("./components/SchedulePlaceMap", () => ({ SchedulePlaceMap: ({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) => <button type="button" onClick={() => onSelect("p2")}>地図から場所を選ぶ {selected}</button> }));
vi.mock("@/components/admin/ShopPreview", () => ({ ShopPreview: () => <div>店舗バナー</div> }));
import MarketSchedulePage from "./page";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const payload = { places: [{ id: "p", store_number: 1, official_number: 183, branch_number: 1, district: "三丁目", place_name: null }], vendors: [{ id: "v1", shop_name: "店A" }, { id: "v2", shop_name: "店B" }], memberships: [{ id: "m1", location_id: "p", vendor_id: "v1", vendor_number: 1 }], periods: [{ id: "period", membership_id: "m1", starts_on: "2020-01-01", ends_on: null }], rules: [{ id: "rule", membership_id: "m1", period_id: "period", cadence: "weekly", starts_on: "2020-01-05", ends_on: null, anchor_on: null, month_weeks: null }], overrides: [] };
describe("出店予定管理", () => {
  it("場所別に直近の予定を表示し、店舗名からバナーを開ける", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<MarketSchedulePage />);
    expect(await screen.findByRole("option", { name: /住所 183-1/ })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "直近の予定" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "出店予定管理の操作" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "繰り返し予定" })).toHaveAttribute("href", "#recurrence");
    expect(screen.getByText("登録履歴のある店舗 1 件")).toBeTruthy();
    expect(screen.getAllByText("店A").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "店舗1：店A" }));
    expect(screen.getByText("店舗バナー")).toBeTruthy();
  });
  it("読み込みに失敗した場合、読み込み中のままにしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    render(<MarketSchedulePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("出店予定を取得できませんでした");
    expect(screen.queryByText("出店予定を読み込んでいます…")).toBeNull();
  });
  it("地図と一覧の選択が連動し、別の場所の店舗を表示する", async () => {
    const places = [...payload.places, { id: "p2", store_number: 2, official_number: 184, branch_number: null, district: "三丁目", place_name: null }];
    const memberships = [...payload.memberships, { id: "m2", location_id: "p2", vendor_id: "v2", vendor_number: 1 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...payload, places, memberships }), { status: 200 })));
    render(<MarketSchedulePage />);
    fireEvent.click(await screen.findByRole("button", { name: "地図から場所を選ぶ p" }));
    expect((screen.getByLabelText("場所を選ぶ") as HTMLSelectElement).value).toBe("p2");
    expect(screen.getByRole("button", { name: "店舗1：店B" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("場所を選ぶ"), { target: { value: "p" } });
    expect(screen.getByRole("button", { name: "地図から場所を選ぶ p" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "店舗1：店A" })).toBeTruthy();
  });
  it("同じ場所の別店舗登録は確認を取り、確認後の件数を送る", async () => {
    const calls: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) return new Response(JSON.stringify(payload), { status: 200 });
      const body = JSON.parse(String(init.body)); calls.push(body);
      return body.confirmed ? new Response(JSON.stringify({ ok: true }), { status: 200 }) : new Response(JSON.stringify({ error: "別の店舗があります", needsConfirmation: true, count: 1 }), { status: 409 });
    }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MarketSchedulePage />);
    const select = await screen.findByLabelText("店舗", { selector: "select" }).catch(() => null);
    const selects = screen.getAllByLabelText("店舗", { selector: "select" });
    expect(select ?? selects[0]).toBeTruthy();
    fireEvent.change(selects[0], { target: { value: "v2" } });
    fireEvent.click(screen.getByRole("button", { name: "場所に登録" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(calls[1]).toMatchObject({ confirmed: true, seenCount: 1 });
  });
});
