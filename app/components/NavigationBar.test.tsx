import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import NavigationBar from "./NavigationBar";

// パスは各テストで差し替える
let currentPathname = "/map";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ロールは各テストで差し替える
let isModerator = false;

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isLoggedIn: false,
    permissions: { isAdmin: false, isModerator, isVendor: false },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/ui/MenuContext", () => ({
  useMenu: () => ({ isMenuOpen: false, openMenu: vi.fn(), closeMenu: vi.fn(), toggleMenu: vi.fn() }),
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
