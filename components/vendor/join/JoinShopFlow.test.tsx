import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import JoinShopFlow from "./JoinShopFlow";
import { ApiError } from "@/lib/utils/apiRequest";

const previewJoin = vi.fn();
const acceptJoin = vi.fn();
const refreshSession = vi.fn();
let auth: { user: Record<string, unknown> | null; isLoading: boolean };

vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: { refreshSession: () => refreshSession(), signInWithOAuth: vi.fn() } }) }));
vi.mock("@/app/vendor/_services/joinService", () => ({
  previewJoin: (...args: unknown[]) => previewJoin(...args),
  acceptJoin: (...args: unknown[]) => acceptJoin(...args),
}));

const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  auth = { user: { id: "u1", email: "me@example.com", name: "me" }, isLoading: false };
  previewJoin.mockResolvedValue({ status: "ok", shopName: "山田農園", permissions: ["store_edit", "post"], expiresAt: null });
  acceptJoin.mockResolvedValue(undefined);
  refreshSession.mockResolvedValue({ error: null });
  Object.defineProperty(window, "location", { value: { ...window.location, assign, origin: "https://nicchyo.example", pathname: "/join/t", search: "" }, writable: true });
});

describe("JoinShopFlow（招待リンク）", () => {
  it("どのお店か・できることを見せ、ログイン中なら参加ボタンを出す", async () => {
    render(<JoinShopFlow kind="invite" token="tok" />);

    expect(await screen.findByText(/山田農園/)).toBeInTheDocument();
    expect(screen.getByText("店舗情報の編集")).toBeInTheDocument();
    expect(screen.getByText("近況の投稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "このお店に参加する" })).toBeInTheDocument();
    expect(previewJoin).toHaveBeenCalledWith("invite", "tok");
  });

  it("ログインしていなければ、参加ボタンの代わりに Google ログインを出す", async () => {
    auth = { user: null, isLoading: false };
    render(<JoinShopFlow kind="invite" token="tok" />);

    expect(await screen.findByRole("button", { name: "Googleでログイン" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "このお店に参加する" })).not.toBeInTheDocument();
  });

  it("参加したら、ログインの情報を作り直してから、マイ店舗へ移る", async () => {
    render(<JoinShopFlow kind="invite" token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "このお店に参加する" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/my-shop"));
    expect(acceptJoin).toHaveBeenCalledWith("invite", "tok");
    expect(refreshSession.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0]);
  });

  it("使えないリンク（期限切れなど）は、理由を出して参加ボタンは出さない", async () => {
    previewJoin.mockResolvedValue({ status: "unavailable", message: "この招待リンクは期限が切れています。" });
    render(<JoinShopFlow kind="invite" token="tok" />);

    expect(await screen.findByText("この招待リンクは期限が切れています。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "このお店に参加する" })).not.toBeInTheDocument();
  });

  it("参加に失敗したら理由を出す。すでに別の店にいるときはマイ店舗への案内も出す", async () => {
    acceptJoin.mockRejectedValue(new ApiError("すでに、お店に参加しています。", 409, "already_member"));
    render(<JoinShopFlow kind="invite" token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "このお店に参加する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("すでに、お店に参加しています。");
    expect(screen.getByRole("link", { name: "マイ店舗を開く" })).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("ログインの情報を作り直せなかったときは、ログインし直しを案内する（移動しない）", async () => {
    refreshSession.mockResolvedValue({ error: { message: "x" } });
    render(<JoinShopFlow kind="invite" token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "このお店に参加する" }));

    expect(await screen.findByText(/もう一度Googleでログイン/)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("JoinShopFlow（QR コード）", () => {
  it("代表者として登録する文言を出し、QR 用の API を呼ぶ。できること（権限）の欄は出さない", async () => {
    previewJoin.mockResolvedValue({ status: "ok", shopName: "田中商店", permissions: [], expiresAt: null });
    render(<JoinShopFlow kind="claim" token="qr" />);

    expect(await screen.findByText(/代表者として、このアカウントを登録します/)).toBeInTheDocument();
    expect(screen.queryByText("できること")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "代表者として登録する" }));

    await waitFor(() => expect(acceptJoin).toHaveBeenCalledWith("claim", "qr"));
  });

  it("紐づけは済んだがロールの付与に失敗したとき（role_failed）は、ログインし直しを案内する", async () => {
    acceptJoin.mockRejectedValue(new ApiError("仕上げに失敗しました", 500, "role_failed"));
    render(<JoinShopFlow kind="claim" token="qr" />);
    fireEvent.click(await screen.findByRole("button", { name: "代表者として登録する" }));

    expect(await screen.findByText(/もう一度Googleでログイン/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
