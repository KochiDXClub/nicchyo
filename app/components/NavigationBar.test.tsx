import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import NavigationBar from "./NavigationBar";

// パスは各テストで差し替える
let currentPathname = "/map";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

// ロールとメニューの開閉は各テストで差し替える
let isModerator = false;
let isVendor = false;
let menuOpen = false;

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: isVendor ? { id: "v1", name: "山田農園" } : null,
    isLoggedIn: isVendor,
    permissions: { isAdmin: false, isModerator, isVendor },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/ui/MenuContext", () => ({
  useMenu: () => ({ isMenuOpen: menuOpen, openMenu: vi.fn(), closeMenu: vi.fn(), toggleMenu: vi.fn() }),
}));

// 公開でないパスは各テストで差し替える
let hiddenPaths: string[] = [];

vi.mock("@/lib/pageVisibility/PageVisibilityContext", () => ({
  usePageVisibility: () => ({ isLinkVisible: (path: string) => !hiddenPaths.includes(path) }),
}));

vi.mock("./MapLoadingProvider", () => ({
  useMapLoading: () => ({ startMapLoading: vi.fn() }),
}));

vi.mock("./MenuGrandma", () => ({ default: () => null }));

/** ラベルから、色クラスを持つ要素（NavLinkItem の <a>、近況の選択ボタンの <button>）を取り出す */
function navLink(label: string) {
  const link = screen.getByText(label).closest("a, button");
  if (!link) throw new Error(`${label} のリンクが見つかりません`);
  return link;
}

describe("NavigationBar の「今いるページ」表示", () => {
  afterEach(() => {
    currentPathname = "/map";
  });

  it("マップ読み込み中（activeHref='/map'）に相談を点灯させない", () => {
    render(<NavigationBar activeHref="/map" />);
    // 相談の遷移先は /consult。マップにいるだけで点灯してはいけない
    expect(navLink("相談").className).not.toContain("text-amber-600");
  });

  it("マップにいても近況は点灯しない", () => {
    render(<NavigationBar activeHref="/map" />);
    expect(navLink("近況").className).not.toContain("text-amber-600");
  });
});

describe("NavigationBar の近況ボタンの行き先", () => {
  afterEach(() => {
    hiddenPaths = [];
    isModerator = false;
  });

  it("近況とデモの両方が公開なら、モデレーター以上は押すとどちらへ行くか選べる", () => {
    isModerator = true;
    render(<NavigationBar activeHref="/map" />);
    fireEvent.click(screen.getByRole("button", { name: "近況" }));

    const group = screen.getByRole("group", { name: "近況の行き先" });
    const links = within(group).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/story", "/demo/story"]);
  });

  it("近況とデモの両方が公開でも、来訪者には選択メニューを出さず近況へ直接行く", () => {
    render(<NavigationBar activeHref="/map" />);
    expect(navLink("近況").getAttribute("href")).toBe("/story");
    expect(screen.queryByRole("group", { name: "近況の行き先" })).not.toBeInTheDocument();
  });

  it("近況だけ公開なら、近況へ直接行く", () => {
    hiddenPaths = ["/demo/story"];
    render(<NavigationBar activeHref="/map" />);
    expect(navLink("近況").getAttribute("href")).toBe("/story");
  });

  it("デモだけ公開なら、デモへ直接行く", () => {
    hiddenPaths = ["/story"];
    render(<NavigationBar activeHref="/map" />);
    expect(navLink("近況").getAttribute("href")).toBe("/demo/story");
  });

  it("近況もデモも公開でなければ、ボタンを出さない", () => {
    hiddenPaths = ["/story", "/demo/story"];
    render(<NavigationBar activeHref="/map" />);
    expect(screen.queryByText("近況")).not.toBeInTheDocument();
  });
});

describe("NavigationBar のメニューの出店者ページ", () => {
  beforeEach(() => {
    menuOpen = true;
    push.mockReset();
  });

  afterEach(() => {
    menuOpen = false;
    isVendor = false;
    hiddenPaths = [];
  });

  it("出店者には、出店者ページへの入口を1つだけ、来訪者向けの項目より上に出す", () => {
    isVendor = true;
    render(<NavigationBar activeHref="/map" />);

    const buttons = screen.getAllByRole("button").map((button) => button.textContent ?? "");
    const vendorIndex = buttons.findIndex((text) => text.includes("出店者ページ"));
    const visitIndex = buttons.findIndex((text) => text.includes("お気に入り"));
    expect(vendorIndex).toBeGreaterThanOrEqual(0);
    expect(vendorIndex).toBeLessThan(visitIndex);
    // 使われていない古い出店者ページへの項目は出さない
    expect(screen.queryByText("出店者ダッシュボード")).not.toBeInTheDocument();
    expect(screen.queryByText("商品管理")).not.toBeInTheDocument();
    expect(screen.queryByText("注文管理")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /出店者ページ/ }));
    expect(push).toHaveBeenCalledWith("/my-shop");
  });

  it("来訪者には出店者ページを出さない", () => {
    render(<NavigationBar activeHref="/map" />);
    expect(screen.queryByText("出店者ページ")).not.toBeInTheDocument();
  });
});
