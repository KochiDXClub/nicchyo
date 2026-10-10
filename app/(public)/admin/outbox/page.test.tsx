import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
let query = "";
let permissions = { isAdmin: true };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions, isLoading: false }) }));
vi.mock("@/components/admin", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("./components/VendorNoticeSection", () => ({ VendorNoticeSection: () => <p>出店者へのお知らせのフォーム</p> }));
vi.mock("./components/BroadcastEmailSection", () => ({ BroadcastEmailSection: () => <p>お知らせメールのフォーム</p> }));

import OutboxPage from "./page";

beforeEach(() => {
  replace.mockClear();
  query = "";
  permissions = { isAdmin: true };
});

describe("お知らせ（送信）のページ", () => {
  it("フォームは縦に並べず、タブで1つずつ開く（最初は出店者へのお知らせ）", () => {
    render(<OutboxPage />);
    expect(screen.getByRole("tab", { name: "出店者へのお知らせ" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("出店者へのお知らせのフォーム")).toBeTruthy();
    expect(screen.queryByText("お知らせメールのフォーム")).toBeNull();
  });

  it("タブを切り替えると、もう一方のフォームだけが出て、?tab= に残る", () => {
    render(<OutboxPage />);
    fireEvent.click(screen.getByRole("tab", { name: "お知らせメール" }));
    expect(screen.getByText("お知らせメールのフォーム")).toBeTruthy();
    expect(screen.queryByText("出店者へのお知らせのフォーム")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/admin/outbox?tab=email", { scroll: false });
  });

  it("?tab=email で直接開ける", () => {
    query = "tab=email";
    render(<OutboxPage />);
    expect(screen.getByText("お知らせメールのフォーム")).toBeTruthy();
  });

  it("管理者でなければ何も出さない", () => {
    permissions = { isAdmin: false };
    const { container } = render(<OutboxPage />);
    expect(container.firstChild).toBeNull();
  });
});
