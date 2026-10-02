import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const list = vi.fn();
const getPublicUrl = vi.fn();
const from = vi.fn();

vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ storage: { from } }) }));
vi.mock("@/lib/image/clientCompression", () => ({
  resizeImageToBlob: async () => new Blob(["x"], { type: "image/webp" }),
  imageUploadInfo: (blob: Blob) => ({ contentType: blob.type, ext: "webp" }),
}));

import { deleteAccountAvatars, uploadAccountAvatar } from "./accountProfileService";

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ upload, remove, list, getPublicUrl });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  list.mockResolvedValue({ data: [{ name: "avatar-old.webp" }] });
  getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://x/${path}` } }));
  vi.spyOn(Date, "now").mockReturnValue(1700000000000);
});

describe("accountProfileService", () => {
  it("本人のフォルダに、毎回ちがう名前で上げ、前の写真を消して、公開 URL を返す", async () => {
    const url = await uploadAccountAvatar("u-1", new File(["x"], "me.png", { type: "image/png" }));

    expect(from).toHaveBeenCalledWith("user-avatars");
    expect(upload).toHaveBeenCalledWith("u-1/avatar-1700000000000.webp", expect.any(Blob), { contentType: "image/webp", upsert: true });
    expect(remove).toHaveBeenCalledWith(["u-1/avatar-old.webp"]);
    expect(url).toBe("https://x/u-1/avatar-1700000000000.webp");
  });

  it("上げるのに失敗したら投げる（前の写真は消さない）", async () => {
    upload.mockResolvedValue({ error: new Error("denied") });
    await expect(uploadAccountAvatar("u-1", new File(["x"], "me.png"))).rejects.toThrow("denied");
    expect(remove).not.toHaveBeenCalled();
  });

  it("前の写真を消せなくても、保存は成功させる", async () => {
    remove.mockRejectedValue(new Error("boom"));
    await expect(uploadAccountAvatar("u-1", new File(["x"], "me.png"))).resolves.toContain("avatar-1700000000000");
  });

  it("写真を消すときは、本人のフォルダの写真をすべて消す", async () => {
    await deleteAccountAvatars("u-1");
    expect(remove).toHaveBeenCalledWith(["u-1/avatar-old.webp"]);
  });
});
