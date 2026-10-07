import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import VendorPostsPage from "./page";

const createPost = vi.fn();
const fetchVendorPostsMock = vi.fn();
const repostContentMock = vi.fn();

// 本物と同じく、描き直しても同じ user を返す
// 店舗の ID（shop-1）はアカウントの ID（v1）と別の値にして、user.id を店舗 ID に使っていないことも確かめる
const AUTH = { user: { id: "v1", name: "yamada", vendorId: "shop-1" } };
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => AUTH,
}));

vi.mock("@/lib/image/clientCompression", () => ({
  canDecodeImage: async () => true,
  imageErrorMessage: (_err: unknown, fallback: string) => fallback,
  IMAGE_DECODE_ERROR_MESSAGE: "読めない写真です",
}));

vi.mock("../_services/postsService", () => ({
  createPost: (...args: unknown[]) => createPost(...args),
  fetchPostIdentity: async () => ({ shopName: "山田農園", shopImageUrl: null }),
  fetchVendorPosts: (...args: unknown[]) => fetchVendorPostsMock(...args),
  repostContent: (...args: unknown[]) => repostContentMock(...args),
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function pickPhoto() {
  const file = new File(["x"], "tomato.jpg", { type: "image/jpeg" });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("写真を選ぶ"), { target: { files: [file] } });
  });
  return file;
}

const OLD_POST = {
  id: "old",
  vendor_id: "shop-1",
  text: "前のひとこと",
  image_url: "https://example.supabase.co/old.webp",
  created_at: "2026-01-01T00:00:00Z",
  expiration_time: "2026-01-04T00:00:00Z",
  status: "expired",
  viewCount: 3,
  heartCount: 1,
};

describe("近況ページ（近況を出す＋投稿履歴）", () => {
  beforeEach(() => {
    createPost.mockReset();
    repostContentMock.mockReset();
    fetchVendorPostsMock.mockReset();
    fetchVendorPostsMock.mockResolvedValue([OLD_POST]);
    window.scrollTo = vi.fn();
    createPost.mockResolvedValue({ id: "p1", text: "", image_url: "https://example.supabase.co/p1.webp" });
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("はじめは写真を撮る・選ぶだけを出す。投稿のポイントの説明は出さない", async () => {
    render(<VendorPostsPage />);
    await flush();
    expect(screen.getByRole("button", { name: "撮る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "写真を選ぶ" })).toBeInTheDocument();
    expect(screen.queryByText("投稿のポイント")).not.toBeInTheDocument();
    expect(screen.getByLabelText("カメラで撮る")).toHaveAttribute("capture", "environment");
  });

  it("写真を選ぶと、店名の入った見本の上でひとことを書け、ひとこと無しでも出せる", async () => {
    render(<VendorPostsPage />);
    await flush();
    const file = await pickPhoto();

    expect(screen.getByAltText("投稿する写真")).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText("山田農園")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /近況に出す/ }));
    });

    expect(createPost).toHaveBeenCalledWith("shop-1", "", expect.any(Date), file, undefined);
    expect(screen.getByRole("status")).toHaveTextContent("近況に出しました！");
    expect(screen.getByRole("link", { name: /近況で見てみる/ })).toHaveAttribute("href", "/story?content=p1");
  });

  it("時間を決めるを選んで日時を入れないうちは、出すボタンを押せない", async () => {
    render(<VendorPostsPage />);
    await flush();
    await pickPhoto();

    fireEvent.click(screen.getByRole("button", { name: "時間を決める" }));
    expect(screen.getByRole("button", { name: "時間を決める" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /近況に出す/ })).toBeDisabled();
    // 押せない理由を出す
    expect(screen.getByText("日時を選ぶと出せます")).toBeInTheDocument();
  });

  it("「×」で写真を選び直せる", async () => {
    render(<VendorPostsPage />);
    await flush();
    await pickPhoto();

    fireEvent.click(screen.getByRole("button", { name: "写真を選び直す" }));
    expect(screen.getByRole("button", { name: "撮る" })).toBeInTheDocument();
  });

  it("出せなかったときは理由を出して、書いたものは残す", async () => {
    createPost.mockRejectedValueOnce(new Error("network"));
    render(<VendorPostsPage />);
    await flush();
    await pickPhoto();
    fireEvent.change(screen.getByLabelText("ひとこと（なくても出せます）"), { target: { value: "トマト入荷" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /近況に出す/ }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("うまく出せませんでした");
    expect(screen.getByLabelText("ひとこと（なくても出せます）")).toHaveValue("トマト入荷");
  });

  it("同じページに、写真を選ぶ入口と、これまでの投稿の履歴が並ぶ", async () => {
    render(<VendorPostsPage />);
    await flush();

    expect(screen.getByRole("button", { name: "撮る" })).toBeInTheDocument();
    expect(screen.getByText("前のひとこと")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /そのまま再投稿/ })).toBeInTheDocument();
  });

  it("出し終えたら「投稿の一覧に戻る」で履歴に戻れ、出した近況が先頭に載る", async () => {
    createPost.mockResolvedValueOnce({ id: "p1", text: "", image_url: "https://example.supabase.co/p1.webp", status: "active" });
    render(<VendorPostsPage />);
    await flush();
    await pickPhoto();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /近況に出す/ }));
    });

    fireEvent.click(screen.getByRole("button", { name: "投稿の一覧に戻る" }));

    expect(screen.getByRole("button", { name: "撮る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /すべて\s*2/ })).toBeInTheDocument();
  });

  it("「編集して再投稿」で、前の写真とひとことが入った書く画面が開く", async () => {
    render(<VendorPostsPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /編集して再投稿/ }));

    // 保存済みの写真は next/image の最適化を通る
    expect(screen.getByAltText("投稿する写真").getAttribute("src")).toContain(
      encodeURIComponent("https://example.supabase.co/old.webp")
    );
    expect(screen.getByLabelText("ひとこと（なくても出せます）")).toHaveValue("前のひとこと");
  });
});
