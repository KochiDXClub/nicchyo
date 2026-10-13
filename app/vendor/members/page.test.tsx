import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { ShopMembership } from "@/lib/vendor/shopPermissions";
import VendorMembersPage from "./page";

let membership: ShopMembership;
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "山田", email: "me@example.com", provider: "google", role: "vendor", vendorId: "shop-1", shopMembership: membership },
  }),
}));

let members: unknown;
let loadError: string | null;
const reload = vi.fn();
vi.mock("./useMembers", () => ({ useMembers: () => ({ data: members, error: loadError, loading: false, reload }) }));
vi.mock("../_services/membersService", () => ({
  fetchInvites: async () => [],
  fetchActivityLogs: async () => ({ logs: [], hasMore: false }),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  updateMemberPermissions: vi.fn(),
  removeMember: vi.fn(),
  transferOwnership: vi.fn(),
}));

function setup(me: ShopMembership) {
  membership = me;
  loadError = null;
  members = {
    members: [{ userId: "u1", name: "山田", email: null, role: me.role, permissions: me.permissions, joinedAt: "2026-10-01T00:00:00Z", isMe: true }],
    me,
  };
  return render(<VendorMembersPage />);
}

beforeEach(() => vi.clearAllMocks());

describe("メンバー管理", () => {
  it("代表者には、メンバー・招待・操作ログが出る", async () => {
    setup({ role: "owner", permissions: [] });

    expect(screen.getByRole("heading", { level: 1, name: "メンバー管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "お店のメンバー（1人）" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "家族やスタッフを招待する" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "操作ログ" })).toBeInTheDocument();
  });

  it("近況の投稿だけのメンバーには、メンバー一覧だけが出る（招待・操作ログは出ない）", () => {
    setup({ role: "member", permissions: ["post"] });

    expect(screen.getByRole("heading", { name: "お店のメンバー（1人）" })).toBeInTheDocument();
    expect(screen.queryByText("家族やスタッフを招待する")).not.toBeInTheDocument();
    expect(screen.queryByText("操作ログ")).not.toBeInTheDocument();
  });

  it("操作ログの権限だけのメンバーには、操作ログが出る（招待は出ない）", async () => {
    setup({ role: "member", permissions: ["audit_view"] });

    expect(await screen.findByRole("heading", { name: "操作ログ" })).toBeInTheDocument();
    expect(screen.queryByText("家族やスタッフを招待する")).not.toBeInTheDocument();
  });

  it("読み込めなかったら理由を出し、もう一度読み込める", () => {
    membership = { role: "owner", permissions: [] };
    members = null;
    loadError = "通信できませんでした";
    render(<VendorMembersPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("通信できませんでした");
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    expect(reload).toHaveBeenCalled();
  });
});
