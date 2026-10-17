import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AdminSidebar } from "./AdminSidebar";

let currentPathname = "/admin/reports";
let inboxTotal = 3;
const push = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/hooks/useAdminInboxCounts", () => ({
  useAdminInboxCounts: () => ({ total: inboxTotal }),
}));

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "高知太郎", role: "admin" },
    logout,
    permissions: { isAdmin: true, isModerator: false, canModerateContent: true },
  }),
}));

function renderSidebar(onClose = vi.fn()) {
  return render(<AdminSidebar isOpen={false} onToggle={vi.fn()} onClose={onClose} />);
}

// 見た目は出店者ページと共通の ConsoleSidebar。出店者側の都合で直したときに管理画面が壊れないかを見る
describe("AdminSidebar（ConsoleSidebar で描く管理画面のサイドバー）", () => {
  afterEach(() => {
    currentPathname = "/admin/reports";
    inboxTotal = 3;
    push.mockClear();
    logout.mockClear();
  });

  it("受信トレイに新着の件数を出し、0件なら出さない", () => {
    const { unmount } = renderSidebar();
    expect(screen.getByLabelText("受信トレイ 3件")).toBeInTheDocument();
    unmount();

    inboxTotal = 0;
    renderSidebar();
    expect(screen.queryByLabelText(/受信トレイ \d+件/)).not.toBeInTheDocument();
  });

  it("受信トレイの中のタブ（通報）を開いているときも、受信トレイを選択中にしてロールの色の縦線を出す", () => {
    renderSidebar();
    const inbox = screen.getByRole("link", { name: /受信トレイ/ });

    expect(inbox).toHaveAttribute("aria-current", "page");
    expect(inbox.querySelector(".bg-red-500")).not.toBeNull();
    expect(screen.getByRole("link", { name: "ダッシュボード" })).not.toHaveAttribute("aria-current");
  });

  it("スマホ用の開閉ボタンを出す", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "管理メニューを開く" })).toBeInTheDocument();
  });

  it("フッターのログアウトでサイドバーを閉じ、マップへ移る", async () => {
    const onClose = vi.fn();
    renderSidebar(onClose);

    expect(screen.getByText("管理者")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "マップ" })).toHaveAttribute("href", "/map");

    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/map"));
    expect(onClose).toHaveBeenCalled();
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

// 管理画面は各ページが自分で AdminLayout を描くので、ページを移るとサイドバーが作り直される
describe("AdminSidebar のメニューのスクロール位置", () => {
  // jsdom は scrollTop を持たないので、要素ごとの値をしまえるようにする
  const scrollTops = new WeakMap<Element, number>();
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollTop", {
      configurable: true,
      get() {
        return scrollTops.get(this) ?? 0;
      },
      set(value: number) {
        scrollTops.set(this, value);
      },
    });
  });
  afterAll(() => {
    if (original) Object.defineProperty(Element.prototype, "scrollTop", original);
  });

  it("下の方へスクロールしてから別のページへ移っても、作り直したサイドバーは同じ位置のまま", () => {
    const { unmount } = renderSidebar();
    const nav = screen.getByRole("navigation", { name: "管理メニュー" });
    nav.scrollTop = 240;
    fireEvent.scroll(nav);
    unmount();

    currentPathname = "/admin/settings";
    renderSidebar();
    expect(screen.getByRole("navigation", { name: "管理メニュー" }).scrollTop).toBe(240);
  });
});
