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
vi.mock("./useMembers", () => ({ useMembers: () => ({ data: members, error: null, loading: false, reload: vi.fn() }) }));
vi.mock("../_services/membersService", () => ({
  fetchInvites: async () => [],
  fetchActivityLogs: async () => ({ logs: [], hasMore: false }),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  updateMemberPermissions: vi.fn(),
  removeMember: vi.fn(),
  transferOwnership: vi.fn(),
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
  it("代表者には、メンバー・招待・操作ログが出る。お店を抜けるは、引き継ぎが先という案内になる", async () => {
    setup({ role: "owner", permissions: [] });

    expect(screen.getByText("あなたのアカウント")).toBeInTheDocument();
    expect(screen.getByText("お店のメンバー")).toBeInTheDocument();
    expect(screen.getByText("家族やスタッフを招待する")).toBeInTheDocument();
    expect(await screen.findByText("操作ログ")).toBeInTheDocument();
    expect(screen.getByText(/先に別のメンバーへ代表者を引き継いでから/)).toBeInTheDocument();
    // パスワードやメールの編集は、もう無い（Googleでログイン）
    expect(screen.queryByText("パスワード")).not.toBeInTheDocument();
  });

  it("近況の投稿だけのメンバーには、メンバー一覧とお店を抜けるだけが出る（招待・操作ログは出ない）", () => {
    setup({ role: "member", permissions: ["post"] });

    expect(screen.getByText("お店のメンバー")).toBeInTheDocument();
    expect(screen.queryByText("家族やスタッフを招待する")).not.toBeInTheDocument();
    expect(screen.queryByText("操作ログ")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "お店を抜ける" })).toBeInTheDocument();
  });

  it("操作ログの権限だけのメンバーには、操作ログが出る（招待は出ない）", async () => {
    setup({ role: "member", permissions: ["audit_view"] });

    expect(await screen.findByText("操作ログ")).toBeInTheDocument();
    expect(screen.queryByText("家族やスタッフを招待する")).not.toBeInTheDocument();
  });
});
