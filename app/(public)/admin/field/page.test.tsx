import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminFieldPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions: { isAdmin: true }, isLoading: false }) }));
vi.mock("@/components/admin", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminPageHeader: () => null,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./components/NewShopForm", () => ({ NewShopForm: () => null }));

afterEach(() => vi.unstubAllGlobals());

it("複数の出店場所を表示し、どの場所からも店舗を検索できる", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ shops: [{
    id: "vendor-1", name: "八百屋", listingStatus: "allowed", category: "野菜", hasPhoto: true,
    hasLocation: true, storeNumber: null, placeName: null,
    places: [{ storeNumber: 12, name: "一丁目 12" }, { storeNumber: 34, name: "二丁目 34" }],
  }] }) })));
  render(<AdminFieldPage />);
  expect(await screen.findByLabelText("出店場所が複数")).toBeTruthy();
  expect(screen.getByText("登録場所（旧配置を含む）：一丁目 12、二丁目 34")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("店名、または店番の数字"), { target: { value: "34" } });
  expect(screen.getByText("八百屋")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("店名、または店番の数字"), { target: { value: "99" } });
  expect(screen.queryByText("八百屋")).toBeNull();
});
