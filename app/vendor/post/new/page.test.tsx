import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import VendorPostNewPage from "./page";

const createPost = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

// 本物と同じく、描き直しても同じ user を返す
const AUTH = { user: { id: "v1", name: "yamada" } };
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => AUTH,
}));

vi.mock("@/lib/image/clientCompression", () => ({
  canDecodeImage: async () => true,
  imageErrorMessage: (_err: unknown, fallback: string) => fallback,
  IMAGE_DECODE_ERROR_MESSAGE: "読めない写真です",
}));

vi.mock("../../_services/postsService", () => ({
  createPost: (...args: unknown[]) => createPost(...args),
  fetchPostIdentity: async () => ({ shopName: "山田農園", shopImageUrl: null }),
  fetchPostById: async () => ({ id: "old", text: "前のひとこと", image_url: "https://example.supabase.co/old.webp" }),
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

describe("投稿画面（近況を出す）", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    createPost.mockReset();
    createPost.mockResolvedValue({ id: "p1", text: "", image_url: "https://example.supabase.co/p1.webp" });
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("はじめは写真を撮る・選ぶだけを出す。投稿のポイントの説明は出さない", async () => {
    render(<VendorPostNewPage />);
    await flush();
    expect(screen.getByRole("button", { name: "撮る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "写真を選ぶ" })).toBeInTheDocument();
    expect(screen.queryByText("投稿のポイント")).not.toBeInTheDocument();
    expect(screen.getByLabelText("カメラで撮る")).toHaveAttribute("capture", "environment");
  });

  it("写真を選ぶと、店名の入った見本の上でひとことを書け、ひとこと無しでも出せる", async () => {
    render(<VendorPostNewPage />);
    await flush();
    const file = await pickPhoto();

    expect(screen.getByAltText("投稿する写真")).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText("山田農園")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /近況に出す/ }));
    });

    expect(createPost).toHaveBeenCalledWith("v1", "", expect.any(Date), file, undefined);
    expect(screen.getByRole("status")).toHaveTextContent("近況に出しました！");
    expect(screen.getByRole("link", { name: /近況で見てみる/ })).toHaveAttribute("href", "/story?content=p1");
  });

  it("時間を決めるを選んで日時を入れないうちは、出すボタンを押せない", async () => {
    render(<VendorPostNewPage />);
    await flush();
    await pickPhoto();

    fireEvent.click(screen.getByRole("button", { name: "時間を決める" }));
    expect(screen.getByRole("button", { name: "時間を決める" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /近況に出す/ })).toBeDisabled();
  });

  it("「×」で写真を選び直せる", async () => {
    render(<VendorPostNewPage />);
    await flush();
    await pickPhoto();

    fireEvent.click(screen.getByRole("button", { name: "写真を選び直す" }));
    expect(screen.getByRole("button", { name: "撮る" })).toBeInTheDocument();
  });

  it("出せなかったときは理由を出して、書いたものは残す", async () => {
    createPost.mockRejectedValueOnce(new Error("network"));
    render(<VendorPostNewPage />);
    await flush();
    await pickPhoto();
    fireEvent.change(screen.getByLabelText("ひとこと（なくても出せます）"), { target: { value: "トマト入荷" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /近況に出す/ }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("うまく出せませんでした");
    expect(screen.getByLabelText("ひとこと（なくても出せます）")).toHaveValue("トマト入荷");
  });

  it("編集して再投稿（?repost=ID）から来たら、前の写真とひとことで始める", async () => {
    searchParams = new URLSearchParams("repost=old");
    render(<VendorPostNewPage />);
    await flush();

    expect(screen.getByAltText("投稿する写真")).toHaveAttribute("src", "https://example.supabase.co/old.webp");
    expect(screen.getByLabelText("ひとこと（なくても出せます）")).toHaveValue("前のひとこと");
  });
});
