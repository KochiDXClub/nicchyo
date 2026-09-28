import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import NavigationBar from "./NavigationBar";

// パスは各テストで差し替える
let currentPathname = "/map";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isLoggedIn: false,
    permissions: { isAdmin: false, isModerator: false, isVendor: false },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/ui/MenuContext", () => ({
  useMenu: () => ({ isMenuOpen: false, openMenu: vi.fn(), closeMenu: vi.fn(), toggleMenu: vi.fn() }),
}));

vi.mock("@/lib/pageVisibility/PageVisibilityContext", () => ({
  usePageVisibility: () => ({ isLinkVisible: () => true }),
}));

vi.mock("./MapLoadingProvider", () => ({
  useMapLoading: () => ({ startMapLoading: vi.fn() }),
}));

vi.mock("./MenuGrandma", () => ({ default: () => null }));

/** ラベルから、色クラスを持つリンク要素（NavLinkItem の <a>）を取り出す */
function navLink(label: string) {
  const link = screen.getByText(label).closest("a");
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
