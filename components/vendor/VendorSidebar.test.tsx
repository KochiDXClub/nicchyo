import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import VendorSidebar from "./VendorSidebar";

let currentPathname = "/vendor/posts";
const push = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push }),
}));

// 権限は testPermissions に入れたものだけ true（"all" なら全部 true）
let testPermissions: string[] | "all" = "all";
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "山田商店" },
    logout,
    permissions: { canShop: (key: string) => testPermissions === "all" || testPermissions.includes(key) },
  }),
}));

function renderSidebar() {
  return render(<VendorSidebar isOpen={false} onToggle={vi.fn()} onClose={vi.fn()} />);
}

describe("VendorSidebar（管理画面と同じ ConsoleSidebar で描く）", () => {
  afterEach(() => {
    currentPathname = "/vendor/posts";
    testPermissions = "all";
    push.mockClear();
    logout.mockClear();
  });

  it("見出し付きのグループに分けて並べ、マイ店舗へのリンクを先頭に置く", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "出店者メニュー" });

    expect(within(nav).getByText("ホーム")).toBeInTheDocument();
    expect(within(nav).getByText("お店のこと")).toBeInTheDocument();
    expect(within(nav).getByText("使い方・設定")).toBeInTheDocument();
    expect(within(nav).getAllByRole("link")[0]).toHaveAttribute("href", "/my-shop");
    // 下部バーに常設している導線も、PC のサイドバーには出す
    expect(within(nav).getByRole("link", { name: "近況を出す" })).toHaveAttribute("href", "/vendor/posts");
    expect(within(nav).getByRole("link", { name: "運営・市役所との連絡" })).toBeInTheDocument();
  });

  it("いま開いている画面（配下の画面を含む）の項目だけを選択中にする", () => {
    currentPathname = "/vendor/store/photos";
    renderSidebar();

    expect(screen.getByRole("link", { name: "店舗情報を更新" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "近況を出す" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "マイ店舗" })).not.toHaveAttribute("aria-current");
  });

  it("権限のない導線は出さず、権限の要らない導線（使い方・アカウント）は常に出す", () => {
    testPermissions = ["post"];
    renderSidebar();

    expect(screen.queryByRole("link", { name: "店舗情報を更新" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "お店の分析" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "近況を出す" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "よくある質問" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "アカウント設定" })).toBeInTheDocument();
  });

  it("お店のことの権限が一つもないときは、空の見出しを出さない", () => {
    testPermissions = [];
    renderSidebar();

    expect(screen.queryByText("お店のこと")).not.toBeInTheDocument();
    expect(screen.getByText("使い方・設定")).toBeInTheDocument();
  });

  it("フッターに名前と役割を出し、マップへのリンクとログアウトを置く", async () => {
    renderSidebar();

    expect(screen.getByText("山田商店")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "マップを見る" })).toHaveAttribute("href", "/map");

    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("スマホでは下部バーが導線を受け持つので、左上の開閉ボタンを出さない", () => {
    renderSidebar();

    expect(screen.queryByRole("button", { name: "出店者メニューを開く" })).not.toBeInTheDocument();
  });
});
