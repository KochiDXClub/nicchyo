import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { ShopMembership } from "@/lib/vendor/shopPermissions";
import VendorAccountPage from "./page";

let membership: ShopMembership;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "山田", email: "me@example.com", provider: "google", role: "vendor", vendorId: "shop-1", shopMembership: membership },
    logout: vi.fn(),
  }),
}));

let members: unknown;
vi.mock("../members/useMembers", () => ({ useMembers: () => ({ data: members, error: null, loading: false, reload: vi.fn() }) }));
vi.mock("../_services/membersService", () => ({
  leaveShop: vi.fn(),
}));

function setup(me: ShopMembership) {
  membership = me;
  members = {
    members: [{ userId: "u1", name: "山田", email: null, role: me.role, permissions: me.permissions, joinedAt: "2026-10-01T00:00:00Z", isMe: true }],
    me,
  };
  return render(<VendorAccountPage />);
}

describe("アカウント設定", () => {
  it("代表者には、メンバー管理への入口が出る。お店を抜けるは、引き継ぎが先という案内になる", () => {
    setup({ role: "owner", permissions: [] });

    expect(screen.getByText("あなたのアカウント")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "お店のメンバー" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "メンバー管理を開く" })).toHaveAttribute("href", "/vendor/members");
    expect(screen.getByText(/先に別のメンバーへ代表者を引き継いでから/)).toBeInTheDocument();
    // パスワードやメールの編集は、もう無い（Googleでログイン）
    expect(screen.queryByText("パスワード")).not.toBeInTheDocument();
  });

  it("メンバーの一覧・招待・操作ログは、メンバー管理へ移ったので、ここには出ない", () => {
    setup({ role: "owner", permissions: [] });

    expect(screen.queryByText("家族やスタッフを招待する")).not.toBeInTheDocument();
    expect(screen.queryByText("操作ログ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /設定を変える/ })).not.toBeInTheDocument();
  });

  it("メンバーには、メンバー管理への入口とお店を抜けるが出る", () => {
    setup({ role: "member", permissions: ["post"] });

    expect(screen.getByRole("link", { name: "メンバー管理を開く" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "お店を抜ける" })).toBeInTheDocument();
  });
});
