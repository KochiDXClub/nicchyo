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
const openSheet = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: `${name}さんの設定を変える` }));
  return within(screen.getByRole("dialog", { name: `${name}さんの設定` }));
};

beforeEach(() => {
  vi.clearAllMocks();
  updateMemberPermissions.mockResolvedValue(undefined);
  removeMember.mockResolvedValue(undefined);
  transferOwnership.mockResolvedValue(undefined);
});

describe("MembersSection", () => {
  it("人数・代表者・副代表・あなた・権限・参加日を一覧に出す。メールは返ってきたときだけ出る", () => {
    render(<MembersSection data={data([owner, helper, deputy])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(screen.getByRole("heading", { name: "お店のメンバー（3人）" })).toBeInTheDocument();
    expect(within(row("山田")).getByText("代表者")).toBeInTheDocument();
    expect(within(row("山田")).getByText("あなた")).toBeInTheDocument();
    expect(within(row("副代表B")).getByText("副代表")).toBeInTheDocument();
    expect(within(row("家族A")).queryByText("副代表")).not.toBeInTheDocument();
    expect(screen.getByText("o@example.com")).toBeInTheDocument();
    expect(within(row("家族A")).getByText("近況の投稿")).toBeInTheDocument();
    expect(within(row("家族A")).getByText("2026年10月1日に参加")).toBeInTheDocument();
  });

  it("代表者から見ると、代表者以外の行に「設定を変える」が出て、シートで変更・引き継ぎ・外すができる。自分の行には出ない", () => {
    render(<MembersSection data={data([owner, helper, deputy])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(within(row("山田")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("副代表B")).getByRole("button", { name: "副代表Bさんの設定を変える" })).toBeInTheDocument();

    const sheet = openSheet("家族A");
    expect(sheet.getByRole("heading", { name: "できること" })).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "代表者を引き継ぐ" })).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "お店から外す" })).toBeInTheDocument();
  });

  it("副代表から見ると、メンバーは動かせるが、副代表・代表者は動かせず、引き継ぎもできない", () => {
    const me = member({ userId: "m", name: "わたし", permissions: ["store_edit", "post", "members_manage"], isMe: true });
    render(<MembersSection data={data([{ ...owner, isMe: false }, me, helper, deputy])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(within(row("副代表B")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("山田")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("わたし")).queryByRole("button")).not.toBeInTheDocument();

    const sheet = openSheet("家族A");
    expect(sheet.getByRole("button", { name: "お店から外す" })).toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "代表者を引き継ぐ" })).not.toBeInTheDocument();
  });

  it("メンバーの管理の権限がなければ、ボタンは出ず、誰に頼めばよいかを案内する", () => {
    const me = member({ userId: "m", name: "わたし", permissions: ["post"], isMe: true });
    render(<MembersSection data={data([{ ...owner, isMe: false }, me, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/代表者か副代表に頼んでください/)).toBeInTheDocument();
  });

  it("権限は変えるまで保存できない。変えて保存すると、API を呼んで一覧を読み直す", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    expect(sheet.getByRole("button", { name: "保存する" })).toBeDisabled();
    fireEvent.click(sheet.getByLabelText(/店舗情報の編集/));
    fireEvent.click(sheet.getByRole("button", { name: "保存する" }));

    await waitFor(() => expect(updateMemberPermissions).toHaveBeenCalledWith("h", ["store_edit", "post"]));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("外すときは、確かめてから実行する（やめるならシートの最初に戻り、何もしない）", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByRole("button", { name: "お店から外す" }));
    expect(removeMember).not.toHaveBeenCalled();
    expect(sheet.getByText(/家族Aさんを、お店から外します/)).toBeInTheDocument();
    fireEvent.click(sheet.getByRole("button", { name: "やめる" }));
    expect(removeMember).not.toHaveBeenCalled();
    expect(sheet.getByRole("heading", { name: "できること" })).toBeInTheDocument();

    fireEvent.click(sheet.getByRole("button", { name: "お店から外す" }));
    fireEvent.click(sheet.getByRole("button", { name: "外す" }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith("h"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("代表者の引き継ぎは、確かめてから実行し、終わったら画面の読み直しを頼む（一覧の読み直しではなく）", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByRole("button", { name: "代表者を引き継ぐ" }));
    expect(sheet.getByText(/副代表」として残ります/)).toBeInTheDocument();
    expect(transferOwnership).not.toHaveBeenCalled();
    fireEvent.click(sheet.getByRole("button", { name: "代表者を引き継ぐ" }));

    await waitFor(() => expect(transferOwnership).toHaveBeenCalledWith("h"));
    await waitFor(() => expect(onTransferred).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("全部の権限があるメンバーは、札を並べず一文で出す", () => {
    const full = member({ userId: "f", name: "全部C", permissions: ["store_edit", "post", "ai_notes", "inquiries", "analytics", "audit_view", "members_manage"] });
    render(<MembersSection data={data([owner, full])} onChanged={onChanged} onTransferred={onTransferred} />);

    expect(within(row("全部C")).getByText("代表者以外のほぼすべての操作ができます。")).toBeInTheDocument();
    expect(within(row("全部C")).queryByText("店舗情報の編集")).not.toBeInTheDocument();
  });

  it("副代表がシートを開くと、メンバーの管理と自分が持たない権限は押せず、理由が出る", () => {
    const me = member({ userId: "m", name: "わたし", permissions: ["store_edit", "post", "members_manage"], isMe: true });
    render(<MembersSection data={data([{ ...owner, isMe: false }, me, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    expect(sheet.getByLabelText(/メンバーの管理/)).toBeDisabled();
    expect(sheet.getByLabelText(/お店の分析/)).toBeDisabled();
    expect(sheet.getByLabelText(/店舗情報の編集/)).toBeEnabled();
    expect(sheet.getAllByText(/あなたは付け外しできません/).length).toBeGreaterThan(0);
  });

  it("保存できたらシートを閉じ、何を変えたかを知らせる", async () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByLabelText(/店舗情報の編集/));
    fireEvent.click(sheet.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("status")).toHaveTextContent("家族Aさんのできることを変えました");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("保存が断られたら、保存ボタンのそばに理由を出し、シートは閉じない", async () => {
    updateMemberPermissions.mockRejectedValue(new Error("自分が持っていない権限は変えられません"));
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByLabelText(/店舗情報の編集/));
    fireEvent.click(sheet.getByRole("button", { name: "保存する" }));

    expect(await sheet.findByRole("alert")).toHaveTextContent("自分が持っていない権限は変えられません");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("確かめる画面では、実行ボタンではなく説明の文にフォーカスが当たる。やめると、開いたボタンへ戻る", () => {
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByRole("button", { name: "お店から外す" }));
    expect(document.activeElement).toBe(sheet.getByText(/家族Aさんを、お店から外します/));
    expect(sheet.getByRole("button", { name: "外す" })).toHaveAccessibleDescription(/お店から外します/);

    fireEvent.click(sheet.getByRole("button", { name: "やめる" }));
    expect(document.activeElement).toBe(sheet.getByRole("button", { name: "お店から外す" }));
  });

  it("外したら知らせを出し、読み直した一覧から消えたら、フォーカスを見出しへ移す（押したボタンが消えるため）", async () => {
    const { rerender } = render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByRole("button", { name: "お店から外す" }));
    fireEvent.click(sheet.getByRole("button", { name: "外す" }));
    expect(await screen.findByRole("status")).toHaveTextContent("家族Aさんをお店から外しました");

    rerender(<MembersSection data={data([owner])} onChanged={onChanged} onTransferred={onTransferred} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "お店のメンバー（1人）" })));
  });

  it("API が断ったら、シートの中にその理由を出す（一覧は読み直さない）", async () => {
    removeMember.mockRejectedValue(new Error("このメンバーは外せません"));
    render(<MembersSection data={data([owner, helper])} onChanged={onChanged} onTransferred={onTransferred} />);

    const sheet = openSheet("家族A");
    fireEvent.click(sheet.getByRole("button", { name: "お店から外す" }));
    fireEvent.click(sheet.getByRole("button", { name: "外す" }));

    expect(await sheet.findByRole("alert")).toHaveTextContent("このメンバーは外せません");
    expect(onChanged).not.toHaveBeenCalled();
  });
});
