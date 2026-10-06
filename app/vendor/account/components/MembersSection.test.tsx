import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import type { MembersResponse, ShopMemberView } from "../../_services/membersService";
import MembersSection from "./MembersSection";

const updateMemberPermissions = vi.fn();
const removeMember = vi.fn();
const transferOwnership = vi.fn();
vi.mock("../../_services/membersService", () => ({
  updateMemberPermissions: (...args: unknown[]) => updateMemberPermissions(...args),
  removeMember: (...args: unknown[]) => removeMember(...args),
  transferOwnership: (...args: unknown[]) => transferOwnership(...args),
}));

const member = (over: Partial<ShopMemberView>): ShopMemberView => ({
  userId: "u",
  name: "名無し",
  email: null,
  role: "member",
  permissions: [],
  joinedAt: "2026-10-01T00:00:00Z",
  isMe: false,
  ...over,
});

const owner = member({ userId: "o", name: "山田", role: "owner", isMe: true, email: "o@example.com" });
const helper = member({ userId: "h", name: "家族A", permissions: ["post"] });
const deputy = member({ userId: "d", name: "副代表B", permissions: ["store_edit", "post", "members_manage"] });

function data(members: ShopMemberView[]): MembersResponse {
  const me = members.find((m) => m.isMe)!;
  return { members, me: { role: me.role, permissions: me.permissions } };
}

const onChanged = vi.fn();
const onTransferred = vi.fn();
const row = (name: string) => screen.getByText(name).closest("li")!;

beforeEach(() => {
  vi.clearAllMocks();
  updateMemberPermissions.mockResolvedValue(undefined);
  removeMember.mockResolvedValue(undefined);
  transferOwnership.mockResolvedValue(undefined);
});

describe("MembersSection", () => {
  it("代表者・あなた・権限を一覧に出す。メールは返ってきたときだけ出る", () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(within(row("山田")).getByText("代表者")).toBeInTheDocument();
    expect(within(row("山田")).getByText("あなた")).toBeInTheDocument();
    expect(screen.getByText("o@example.com")).toBeInTheDocument();
    expect(within(row("家族A")).getByText("近況の投稿")).toBeInTheDocument();
  });

  it("代表者から見ると、代表者以外の行に、変更・外す・引き継ぎのボタンが出る。自分の行には出ない", () => {
    render(<MembersSection data={data([owner, helper, deputy])} onChanged={onChanged} onTransferred={onTransferred} />);

    for (const name of ["家族A", "副代表B"]) {
      const r = within(row(name));
      expect(r.getByRole("button", { name: "できることを変える" })).toBeInTheDocument();
      expect(r.getByRole("button", { name: "お店から外す" })).toBeInTheDocument();
      expect(r.getByRole("button", { name: "代表者を引き継ぐ" })).toBeInTheDocument();
    }
    expect(within(row("山田")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("副代表から見ると、メンバーは動かせるが、副代表・代表者は動かせず、引き継ぎもできない", () => {
    const me = member({ userId: "m", name: "わたし", permissions: ["store_edit", "post", "members_manage"], isMe: true });
    render(<MembersSection data={data([{ ...owner, isMe: false }, me, helper, deputy])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(within(row("家族A")).getByRole("button", { name: "できることを変える" })).toBeInTheDocument();
    expect(within(row("家族A")).queryByRole("button", { name: "代表者を引き継ぐ" })).not.toBeInTheDocument();
    expect(within(row("副代表B")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("山田")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("メンバーの管理の権限がなければ、ボタンは出ない", () => {
    const me = member({ userId: "m", name: "わたし", permissions: ["post"], isMe: true });
    render(<MembersSection data={data([{ ...owner, isMe: false }, me, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(screen.queryByRole("button", { name: "できることを変える" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "お店から外す" })).not.toBeInTheDocument();
  });

  it("権限を変えて保存すると、API を呼んで一覧を読み直す", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    fireEvent.click(within(row("家族A")).getByRole("button", { name: "できることを変える" }));
    fireEvent.click(screen.getByLabelText(/店舗情報の編集/));
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => expect(updateMemberPermissions).toHaveBeenCalledWith("h", ["store_edit", "post"]));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("外すときは、確かめてから実行する（やめるなら何もしない）", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    fireEvent.click(within(row("家族A")).getByRole("button", { name: "お店から外す" }));
    expect(removeMember).not.toHaveBeenCalled();
    expect(screen.getByText(/家族Aさんを、お店から外します/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(removeMember).not.toHaveBeenCalled();

    fireEvent.click(within(row("家族A")).getByRole("button", { name: "お店から外す" }));
    fireEvent.click(screen.getByRole("button", { name: "外す" }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith("h"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("代表者の引き継ぎは、確かめてから実行し、終わったら画面の読み直しを頼む（一覧の読み直しではなく）", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    fireEvent.click(within(row("家族A")).getByRole("button", { name: "代表者を引き継ぐ" }));
    expect(screen.getByText(/副代表」として残ります/)).toBeInTheDocument();
    expect(transferOwnership).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "代表者を引き継ぐ" }));

    await waitFor(() => expect(transferOwnership).toHaveBeenCalledWith("h"));
    await waitFor(() => expect(onTransferred).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("API が断ったら、その理由を出す（一覧は読み直さない）", async () => {
    removeMember.mockRejectedValue(new Error("このメンバーは外せません"));
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    fireEvent.click(within(row("家族A")).getByRole("button", { name: "お店から外す" }));
    fireEvent.click(screen.getByRole("button", { name: "外す" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("このメンバーは外せません");
    expect(onChanged).not.toHaveBeenCalled();
  });
});
