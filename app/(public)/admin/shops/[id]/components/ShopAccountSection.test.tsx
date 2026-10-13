import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchShopClaims = vi.fn();
const issueClaims = vi.fn();
const fetchShopInvites = vi.fn();
const createShopInvite = vi.fn();
const revokeShopInvite = vi.fn();
vi.mock("@/lib/admin/shopClaimsClient", () => ({
  fetchShopClaims: (...a: unknown[]) => fetchShopClaims(...a),
  issueClaims: (...a: unknown[]) => issueClaims(...a),
  unlinkShop: vi.fn(),
  fetchShopActivityLogs: vi.fn().mockResolvedValue({ logs: [], hasMore: false }),
  fetchShopInvites: (...a: unknown[]) => fetchShopInvites(...a),
  createShopInvite: (...a: unknown[]) => createShopInvite(...a),
  revokeShopInvite: (...a: unknown[]) => revokeShopInvite(...a),
}));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} /> }));

import { ShopAccountSection } from "./ShopAccountSection";

const row = (state: string) => ({ vendorId: "v1", shopName: "佐藤青果", state, memberCount: state === "claimed" ? 2 : 0 });

beforeEach(() => {
  vi.clearAllMocks();
  fetchShopInvites.mockResolvedValue([]);
});

describe("ShopAccountSection（店舗の詳細の出店者アカウント）", () => {
  it("この店舗の状態を出し、未発行ならQRを発行できる。発行するとQRを表示する", async () => {
    fetchShopClaims.mockResolvedValue([row("unclaimed"), { ...row("claimed"), vendorId: "other" }]);
    issueClaims.mockResolvedValue([{ vendorId: "v1", shopName: "佐藤青果", status: "ok", url: "https://example.com/claim/abc" }]);
    render(<ShopAccountSection vendorId="v1" />);
    expect(await screen.findByText("未発行")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "QRを発行" }));
    await waitFor(() => expect(issueClaims).toHaveBeenCalledWith(["v1"]));
    expect(await screen.findByTestId("qr-sheet")).toBeTruthy();
  });

  it("代表者がいないあいだは招待リンクを作れない（先にQRで代表者を決めるよう案内する）", async () => {
    fetchShopClaims.mockResolvedValue([row("qr_issued")]);
    render(<ShopAccountSection vendorId="v1" />);
    expect(await screen.findByText(/代表者がいる店舗でだけ作れます/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "招待リンクを作る" })).toBeNull();
  });

  it("代表者がいれば、紐づけの解除と招待リンクの作成を出す。作ると、リンクとQRを見せる", async () => {
    fetchShopClaims.mockResolvedValue([row("claimed")]);
    createShopInvite.mockResolvedValue({ id: "i1", url: "https://example.com/join/xyz", expiresAt: "2026-10-20T00:00:00Z" });
    render(<ShopAccountSection vendorId="v1" />);
    expect(await screen.findByRole("button", { name: "紐づけを解除" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /QRを/ })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "3人" }));
    fireEvent.click(screen.getByRole("button", { name: "招待リンクを作る" }));
    await waitFor(() => expect(createShopInvite).toHaveBeenCalledWith("v1", expect.objectContaining({ maxUses: 3 })));
    expect((await screen.findByLabelText("招待リンク") as HTMLInputElement).value).toBe("https://example.com/join/xyz");
    expect(screen.getByTestId("qr").getAttribute("data-value")).toBe("https://example.com/join/xyz");
  });

  it("使えるリンクだけ取り消せる", async () => {
    fetchShopClaims.mockResolvedValue([row("claimed")]);
    fetchShopInvites.mockResolvedValue([
      { id: "i1", permissions: [], maxUses: 2, usedCount: 0, expiresAt: "2026-10-20T00:00:00Z", createdAt: "2026-10-13T00:00:00Z", state: "active" },
      { id: "i2", permissions: [], maxUses: 1, usedCount: 1, expiresAt: "2026-10-20T00:00:00Z", createdAt: "2026-10-12T00:00:00Z", state: "full" },
    ]);
    revokeShopInvite.mockResolvedValue(undefined);
    render(<ShopAccountSection vendorId="v1" />);
    const buttons = await screen.findAllByRole("button", { name: "取り消す" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(revokeShopInvite).toHaveBeenCalledWith("v1", "i1"));
  });
});
