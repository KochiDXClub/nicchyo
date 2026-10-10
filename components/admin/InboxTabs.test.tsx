import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/admin/notifications";
let permissions = { isAdmin: true, isModerator: true, canModerateContent: true };

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions }) }));

import { InboxTabs } from "./InboxTabs";

describe("InboxTabs（受信トレイの中のタブ）", () => {
  it("通知・通報・問い合わせの3つを出し、いまのページを選択状態にする", () => {
    pathname = "/admin/reports";
    permissions = { isAdmin: true, isModerator: true, canModerateContent: true };
    render(<InboxTabs />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["通知", "通報", "問い合わせ"]);
    expect(screen.getByRole("link", { name: "通報" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "通知" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "問い合わせ" }).getAttribute("href")).toBe("/admin/inquiries");
  });

  it("権限のないタブは出さない（コンテンツ担当は通知と問い合わせだけ）", () => {
    pathname = "/admin/notifications";
    permissions = { isAdmin: false, isModerator: false, canModerateContent: true };
    render(<InboxTabs />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["通知", "問い合わせ"]);
  });
});
