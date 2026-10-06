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

import { deleteAccountAvatars, discardAvatar, keepOnlyAvatar, uploadAccountAvatar } from "./accountProfileService";

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
  it("本人のフォルダに、毎回ちがう名前で上げ、公開 URL と保存先を返す。前の写真はここでは消さない", async () => {
    const result = await uploadAccountAvatar("u-1", new File(["x"], "me.png", { type: "image/png" }));

    expect(from).toHaveBeenCalledWith("user-avatars");
    expect(upload).toHaveBeenCalledWith("u-1/avatar-1700000000000.webp", expect.any(Blob), { contentType: "image/webp", upsert: true });
    expect(result).toEqual({ url: "https://x/u-1/avatar-1700000000000.webp", path: "u-1/avatar-1700000000000.webp" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("上げるのに失敗したら投げる", async () => {
    upload.mockResolvedValue({ error: new Error("denied") });
    await expect(uploadAccountAvatar("u-1", new File(["x"], "me.png"))).rejects.toThrow("denied");
  });

  it("keepOnlyAvatar は、残す 1 枚以外を消す。消せなくても投げない", async () => {
    list.mockResolvedValue({ data: [{ name: "avatar-old.webp" }, { name: "avatar-new.webp" }] });
    await keepOnlyAvatar("u-1", "u-1/avatar-new.webp");
    expect(remove).toHaveBeenCalledWith(["u-1/avatar-old.webp"]);

    remove.mockRejectedValue(new Error("boom"));
    await expect(keepOnlyAvatar("u-1", "u-1/avatar-new.webp")).resolves.toBeUndefined();
  });

  it("discardAvatar は、上げた 1 枚を消す。消せなくても投げない", async () => {
    await discardAvatar("u-1/avatar-new.webp");
    expect(remove).toHaveBeenCalledWith(["u-1/avatar-new.webp"]);

    remove.mockRejectedValue(new Error("boom"));
    await expect(discardAvatar("u-1/avatar-new.webp")).resolves.toBeUndefined();
  });

  it("写真を消すときは、本人のフォルダの写真をすべて消す", async () => {
    await deleteAccountAvatars("u-1");
    expect(remove).toHaveBeenCalledWith(["u-1/avatar-old.webp"]);
  });
});
