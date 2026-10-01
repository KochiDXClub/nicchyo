import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import VendorNavBar from "./VendorNavBar";
import { VENDOR_NAV_ITEMS } from "./vendorNavItems";

let currentPathname = "/my-shop";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  // 閉じるアニメーションを待たずにシートを外す
  useReducedMotion: () => true,
}));

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "山田商店" },
    logout: vi.fn(),
  }),
}));

describe("VendorNavBar（来訪者メニューと同じ部品で描く）", () => {
  afterEach(() => {
    currentPathname = "/my-shop";
  });

  it("マイ店舗では中央のメニューボタンで出店者メニューが開き、全項目が並ぶ", () => {
    render(<VendorNavBar />);
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(screen.getByRole("dialog", { name: "出店者メニュー" })).toBeInTheDocument();
    for (const item of VENDOR_NAV_ITEMS) {
      expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "マップを見る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("サブページでは「マイ店舗へ戻る」だけを出す", () => {
    currentPathname = "/vendor/store";
    render(<VendorNavBar />);
    expect(screen.getByRole("button", { name: "マイ店舗へ戻る" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "メニューを開く" })).not.toBeInTheDocument();
  });

  it("下部バーの左は「連絡」（運営・市役所への連絡）", () => {
    render(<VendorNavBar />);
    expect(screen.getByRole("link", { name: "連絡" })).toHaveAttribute("href", "/vendor/inquiries");
  });

  it("開くとシートの中へフォーカスが移り、Esc で閉じるとメニューボタンへ戻る", async () => {
    render(<VendorNavBar />);
    const toggle = screen.getByRole("button", { name: "メニューを開く" });
    fireEvent.click(toggle);

    const dialog = screen.getByRole("dialog", { name: "出店者メニュー" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "メニューを開く" })).toHaveFocus();
  });
});
