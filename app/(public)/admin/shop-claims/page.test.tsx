import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import AdminShopClaimsPage from "./page";

const fetchShopClaims = vi.fn();
const issueClaims = vi.fn();
const unlinkShop = vi.fn();
const fetchShopActivityLogs = vi.fn();
const push = vi.fn();
let isAdmin = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/admin/shop-claims" }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ isLoading: false, permissions: { isAdmin } }) }));
vi.mock("@/lib/admin/shopClaimsClient", () => ({
  fetchShopClaims: () => fetchShopClaims(),
  issueClaims: (...args: unknown[]) => issueClaims(...args),
  unlinkShop: (...args: unknown[]) => unlinkShop(...args),
  fetchShopActivityLogs: (...args: unknown[]) => fetchShopActivityLogs(...args),
}));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
// 管理画面の外枠（サイドバーなど）は、このページの関心ではない
vi.mock("@/components/admin", async () => {
  const actual = await vi.importActual<typeof import("@/components/admin")>("@/components/admin");
  return { ...actual, AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

const shops = [
  { vendorId: "a", shopName: "山田農園", state: "unclaimed", memberCount: 0 },
  { vendorId: "b", shopName: "田中商店", state: "qr_issued", memberCount: 0 },
  { vendorId: "c", shopName: "佐藤青果", state: "claimed", memberCount: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
  fetchShopClaims.mockResolvedValue(shops);
  issueClaims.mockResolvedValue([{ vendorId: "a", shopName: "山田農園", status: "ok", url: "https://nicchyo.example/claim/aaaaaaaaaaaaaaaaaaaaaaaa" }]);
  unlinkShop.mockResolvedValue({ removedMembers: 3 });
  fetchShopActivityLogs.mockResolvedValue({
    logs: [{ id: 1, actorName: "運営", label: "QRコードを発行（再発行）した", summary: "運営がQRコードを発行した", createdAt: "2026-10-03T05:00:00Z" }],
    hasMore: false,
  });
});

const row = (name: string) => screen.getByText(name).closest("tr")!;

describe("店舗のQRコード（管理画面）", () => {
  it("管理者でなければトップへ戻し、何も読み込まない", () => {
    isAdmin = false;
    render(<AdminShopClaimsPage />);

    expect(push).toHaveBeenCalledWith("/");
    expect(fetchShopClaims).not.toHaveBeenCalled();
  });

  it("店舗ごとの状態と、状態に合った操作（発行・再発行・解除）を出す", async () => {
    render(<AdminShopClaimsPage />);
    await screen.findByText("山田農園");

    expect(within(row("山田農園")).getByText("未発行")).toBeInTheDocument();
    expect(within(row("山田農園")).getByRole("button", { name: "QRを発行" })).toBeInTheDocument();
    expect(within(row("田中商店")).getByText("QR発行済み・未紐づけ")).toBeInTheDocument();
    expect(within(row("田中商店")).getByRole("button", { name: "QRを再発行" })).toBeInTheDocument();
    expect(within(row("佐藤青果")).getByText("代表者あり")).toBeInTheDocument();
    expect(within(row("佐藤青果")).getByRole("button", { name: "紐づけを解除" })).toBeInTheDocument();
    expect(screen.getByText(/代表者あり 1 ／ QR発行済み・未紐づけ 1 ／ 未発行 1/)).toBeInTheDocument();
  });

  it("1店舗のQRを発行すると、QRコードのシートを出す", async () => {
    render(<AdminShopClaimsPage />);
    await screen.findByText("山田農園");

    fireEvent.click(within(row("山田農園")).getByRole("button", { name: "QRを発行" }));

    await waitFor(() => expect(issueClaims).toHaveBeenCalledWith(["a"]));
    expect(await screen.findByTestId("qr-sheet")).toBeInTheDocument();
    expect(screen.getByText(/二度と表示できません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /印刷する/ })).toBeInTheDocument();
  });

  it("代表者がいる店舗は、選んで発行することができない。まとめて選ぶのも、代表者のいない店舗だけ", async () => {
    render(<AdminShopClaimsPage />);
    await screen.findByText("山田農園");

    expect(screen.getByLabelText("佐藤青果を選ぶ")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("代表者がいない店舗をすべて選ぶ"));
    fireEvent.click(screen.getByRole("button", { name: /選んだ店舗のQRを発行（2）/ }));

    await waitFor(() => expect(issueClaims).toHaveBeenCalledWith(expect.arrayContaining(["a", "b"])));
    expect(issueClaims.mock.calls[0][0]).toHaveLength(2);
  });

  it("紐づけの解除は、メンバーが外れることを確かめてから実行する。やめるなら何もしない", async () => {
    render(<AdminShopClaimsPage />);
    await screen.findByText("佐藤青果");

    fireEvent.click(within(row("佐藤青果")).getByRole("button", { name: "紐づけを解除" }));
    const dialog = await screen.findByRole("dialog", { name: "紐づけの解除" });
    expect(dialog).toHaveTextContent("メンバー 3人（代表者を含む）がお店から外れ");
    expect(unlinkShop).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "やめる" }));
    expect(unlinkShop).not.toHaveBeenCalled();

    fireEvent.click(within(row("佐藤青果")).getByRole("button", { name: "紐づけを解除" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "解除する" }));
    await waitFor(() => expect(unlinkShop).toHaveBeenCalledWith("c"));
  });

  it("店舗の操作ログを開いて読める", async () => {
    render(<AdminShopClaimsPage />);
    await screen.findByText("佐藤青果");

    fireEvent.click(within(row("佐藤青果")).getByRole("button", { name: "操作ログ" }));

    const dialog = await screen.findByRole("dialog", { name: "佐藤青果の操作ログ" });
    expect(await within(dialog).findByText("運営がQRコードを発行した")).toBeInTheDocument();
    expect(fetchShopActivityLogs).toHaveBeenCalledWith("c", undefined);
  });

  it("状態で絞り込める", async () => {
    render(<AdminShopClaimsPage />);
    await screen.findByText("山田農園");

    fireEvent.click(screen.getByRole("button", { name: "代表者あり" }));

    expect(screen.queryByText("山田農園")).not.toBeInTheDocument();
    expect(screen.getByText("佐藤青果")).toBeInTheDocument();
  });
});
