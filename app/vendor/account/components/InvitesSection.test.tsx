import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import type { ShopMembership } from "@/lib/vendor/shopPermissions";
import InvitesSection from "./InvitesSection";

const fetchInvites = vi.fn();
const createInvite = vi.fn();
const revokeInvite = vi.fn();
vi.mock("../../_services/membersService", () => ({
  fetchInvites: () => fetchInvites(),
  createInvite: (...args: unknown[]) => createInvite(...args),
  revokeInvite: (...args: unknown[]) => revokeInvite(...args),
}));

const owner: ShopMembership = { role: "owner", permissions: [] };
const deputy: ShopMembership = { role: "member", permissions: ["store_edit", "post", "members_manage"] };
const onChanged = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchInvites.mockResolvedValue([]);
  createInvite.mockResolvedValue({ id: "i1", url: "https://nicchyo.example/join/abc", expiresAt: "2026-10-10T00:00:00Z" });
  revokeInvite.mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("InvitesSection", () => {
  it("人数は1〜5人から選べる（6人は選べない）。7日間であることを案内する", async () => {
    render(<InvitesSection membership={owner} onChanged={onChanged} />);

    const group = screen.getByRole("radiogroup", { name: "入れる人数" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["1人", "2人", "3人", "4人", "5人"]);
    expect(screen.getByText(/リンクは7日間使えます/)).toBeInTheDocument();
    await screen.findByText("まだ招待リンクはありません");
  });

  it("選んだ人数と権限でリンクを作り、URL を1回だけ出す。コピーもできる", async () => {
    render(<InvitesSection membership={owner} onChanged={onChanged} />);
    await screen.findByText("まだ招待リンクはありません");

    fireEvent.click(screen.getByRole("radio", { name: "3人" }));
    fireEvent.click(screen.getByLabelText(/お店の分析/));
    fireEvent.click(screen.getByRole("button", { name: "招待リンクを作る" }));

    // 初期値はお手伝い（店舗情報の編集・近況の投稿）に、分析を足した
    await waitFor(() => expect(createInvite).toHaveBeenCalledWith({ maxUses: 3, permissions: ["store_edit", "post", "analytics"] }));
    expect(await screen.findByLabelText("招待リンク")).toHaveValue("https://nicchyo.example/join/abc");
    expect(onChanged).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /リンクをコピー/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://nicchyo.example/join/abc"));
    expect(await screen.findByRole("button", { name: /コピーしました/ })).toBeInTheDocument();
  });

  it("副代表は、メンバー管理の権限と、自分が持たない権限を付けられない（押せない）", async () => {
    render(<InvitesSection membership={deputy} onChanged={onChanged} />);
    await screen.findByText("まだ招待リンクはありません");

    expect(screen.getByLabelText(/メンバーの管理/)).toBeDisabled();
    expect(screen.getByLabelText(/お店の分析/)).toBeDisabled();
    expect(screen.getByLabelText(/店舗情報の編集/)).toBeEnabled();
  });

  it("作れなかったら、API の理由を出す", async () => {
    createInvite.mockRejectedValue(new Error("自分が持っていない権限は付けられません"));
    render(<InvitesSection membership={owner} onChanged={onChanged} />);
    await screen.findByText("まだ招待リンクはありません");

    fireEvent.click(screen.getByRole("button", { name: "招待リンクを作る" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("自分が持っていない権限は付けられません");
    expect(screen.queryByLabelText("招待リンク")).not.toBeInTheDocument();
  });

  it("作ったリンクの状態と参加人数を出し、使えるリンクだけ取り消せる", async () => {
    fetchInvites.mockResolvedValue([
      { id: "a", permissions: ["post"], maxUses: 5, usedCount: 2, expiresAt: "2026-10-09T00:00:00Z", createdAt: "x", state: "active" },
      { id: "b", permissions: [], maxUses: 1, usedCount: 1, expiresAt: "2026-10-09T00:00:00Z", createdAt: "x", state: "full" },
      { id: "c", permissions: [], maxUses: 1, usedCount: 0, expiresAt: "2026-10-09T00:00:00Z", createdAt: "x", state: "revoked" },
    ]);
    render(<InvitesSection membership={owner} onChanged={onChanged} />);

    expect(await screen.findByText("2/5人が参加")).toBeInTheDocument();
    expect(screen.getByText("使えます")).toBeInTheDocument();
    expect(screen.getByText("人数に達した")).toBeInTheDocument();
    expect(screen.getByText("取り消し済み")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "取り消す" })).toHaveLength(1);

    fetchInvites.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "取り消す" }));
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith("a"));
  });
});
