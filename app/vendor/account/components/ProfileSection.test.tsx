import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@/lib/auth/types";

const uploadAccountAvatar = vi.fn();
const deleteAccountAvatars = vi.fn();
const canDecodeImage = vi.fn();

vi.mock("../../_services/accountProfileService", () => ({
  AVATAR_PICK_MAX_BYTES: 10 * 1024 * 1024,
  uploadAccountAvatar: (...args: unknown[]) => uploadAccountAvatar(...args),
  deleteAccountAvatars: (...args: unknown[]) => deleteAccountAvatars(...args),
}));
vi.mock("@/lib/image/clientCompression", () => ({
  canDecodeImage: (...args: unknown[]) => canDecodeImage(...args),
  IMAGE_DECODE_ERROR_MESSAGE: "この形式の写真は読み込めませんでした。",
}));

import ProfileSection from "./ProfileSection";

const user = (over: Partial<User> = {}): User =>
  ({ id: "u-1", name: "山田 太郎", email: "taro@example.com", phone: "090", role: "vendor", provider: "google", ...over }) as User;

const imageFile = (size = 1000, type = "image/png") => new File([new Uint8Array(size)], "me.png", { type });
const pick = (file: File) => fireEvent.change(screen.getByLabelText("写真を選ぶ"), { target: { files: [file] } });

beforeEach(() => {
  vi.clearAllMocks();
  canDecodeImage.mockResolvedValue(true);
  uploadAccountAvatar.mockResolvedValue("https://x.supabase.co/storage/v1/object/public/user-avatars/u-1/avatar-1.webp");
  deleteAccountAvatars.mockResolvedValue(undefined);
});

describe("ProfileSection", () => {
  it("名前を変えて保存すると、メールと電話はそのまま、名前だけ更新する", async () => {
    const updateProfile = vi.fn().mockResolvedValue(true);
    render(<ProfileSection user={user()} updateProfile={updateProfile} />);

    const save = screen.getByRole("button", { name: "名前を保存" });
    expect(save).toBeDisabled(); // 変えていない間は押せない

    fireEvent.change(screen.getByLabelText(/^名前（/), { target: { value: "  やまだ農園  " } });
    fireEvent.click(save);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("名前を変えました"));
    expect(updateProfile).toHaveBeenCalledWith({ name: "やまだ農園", email: "taro@example.com", phone: "090", avatarUrl: undefined });
  });

  it("空の名前は保存できない", () => {
    render(<ProfileSection user={user()} updateProfile={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^名前（/), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "名前を保存" })).toBeDisabled();
  });

  it("保存に失敗したら、エラーを出す", async () => {
    render(<ProfileSection user={user()} updateProfile={vi.fn().mockResolvedValue(false)} />);
    fireEvent.change(screen.getByLabelText(/^名前（/), { target: { value: "別の名前" } });
    fireEvent.click(screen.getByRole("button", { name: "名前を保存" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("名前を変えられませんでした"));
  });

  it("写真を選ぶと、上げて、その URL を保存する（名前はそのまま）", async () => {
    const updateProfile = vi.fn().mockResolvedValue(true);
    render(<ProfileSection user={user()} updateProfile={updateProfile} />);

    pick(imageFile());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("写真を変えました"));
    expect(uploadAccountAvatar).toHaveBeenCalledWith("u-1", expect.any(File));
    expect(updateProfile).toHaveBeenCalledWith({
      name: "山田 太郎",
      email: "taro@example.com",
      phone: "090",
      avatarUrl: "https://x.supabase.co/storage/v1/object/public/user-avatars/u-1/avatar-1.webp",
    });
  });

  it("画像でないファイル・大きすぎる写真・読めない形式は、上げずに知らせる", async () => {
    const updateProfile = vi.fn();
    render(<ProfileSection user={user()} updateProfile={updateProfile} />);

    pick(imageFile(10, "application/pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent("画像ファイル");

    pick(imageFile(11 * 1024 * 1024));
    expect(await screen.findByRole("alert")).toHaveTextContent("10MB以下");

    canDecodeImage.mockResolvedValue(false);
    pick(imageFile());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("読み込めませんでした"));

    expect(uploadAccountAvatar).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("上げるのに失敗したら、URL は保存しない", async () => {
    uploadAccountAvatar.mockRejectedValue(new Error("boom"));
    const updateProfile = vi.fn();
    render(<ProfileSection user={user()} updateProfile={updateProfile} />);

    pick(imageFile());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("写真を上げられませんでした"));
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("写真を消すと、URL を空にしてから、Storage の写真を消す。写真がないときはボタンを出さない", async () => {
    const updateProfile = vi.fn().mockResolvedValue(true);
    const { rerender } = render(<ProfileSection user={user({ avatarUrl: "https://x/a.webp" })} updateProfile={updateProfile} />);

    fireEvent.click(screen.getByRole("button", { name: "写真を消す" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("写真を消しました"));
    expect(updateProfile).toHaveBeenCalledWith({ name: "山田 太郎", email: "taro@example.com", phone: "090", avatarUrl: "" });
    expect(deleteAccountAvatars).toHaveBeenCalledWith("u-1");

    rerender(<ProfileSection user={user({ avatarUrl: undefined })} updateProfile={updateProfile} />);
    expect(screen.queryByRole("button", { name: "写真を消す" })).not.toBeInTheDocument();
  });
});
