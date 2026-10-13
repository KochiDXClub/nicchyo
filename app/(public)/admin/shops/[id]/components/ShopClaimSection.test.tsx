import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchShopClaims = vi.fn();
const issueClaims = vi.fn();
vi.mock("@/lib/admin/shopClaimsClient", () => ({
  fetchShopClaims: (...a: unknown[]) => fetchShopClaims(...a),
  issueClaims: (...a: unknown[]) => issueClaims(...a),
  unlinkShop: vi.fn(),
  fetchShopActivityLogs: vi.fn().mockResolvedValue({ logs: [], hasMore: false }),
}));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-value={value} /> }));

import { ShopClaimSection } from "./ShopClaimSection";

const row = (state: string) => ({ vendorId: "v1", shopName: "佐藤青果", state, memberCount: state === "claimed" ? 2 : 0 });

describe("ShopClaimSection（店舗の詳細の代表者・QR）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("この店舗の状態を出し、未発行ならQRを発行できる。発行するとQRを表示する", async () => {
    fetchShopClaims.mockResolvedValue([row("unclaimed"), { ...row("claimed"), vendorId: "other" }]);
    issueClaims.mockResolvedValue([{ vendorId: "v1", shopName: "佐藤青果", status: "ok", url: "https://example.com/claim/abc" }]);
    render(<ShopClaimSection vendorId="v1" />);
    expect(await screen.findByText("未発行")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "QRを発行" }));
    await waitFor(() => expect(issueClaims).toHaveBeenCalledWith(["v1"]));
    expect(await screen.findByTestId("qr-sheet")).toBeTruthy();
  });

  it("代表者がいるときは発行ではなく紐づけの解除を出す", async () => {
    fetchShopClaims.mockResolvedValue([row("claimed")]);
    render(<ShopClaimSection vendorId="v1" />);
    expect(await screen.findByRole("button", { name: "紐づけを解除" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /QRを/ })).toBeNull();
  });
});
