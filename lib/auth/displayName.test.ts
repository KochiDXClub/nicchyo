import { describe, expect, it } from "vitest";
import { resolveAvatarUrl, resolveDisplayName } from "./displayName";

describe("resolveDisplayName", () => {
  it("本人が設定した名前（display_name）を、Google の名前より優先する", () => {
    expect(resolveDisplayName({ user_metadata: { display_name: "やまだ農園", name: "山田 太郎", full_name: "山田 太郎" } })).toBe("やまだ農園");
  });

  it("設定がなければ Google の名前、それもなければメールの @ より前", () => {
    expect(resolveDisplayName({ user_metadata: { full_name: "山田 太郎" } })).toBe("山田 太郎");
    expect(resolveDisplayName({ email: "taro@example.com", user_metadata: {} })).toBe("taro");
    expect(resolveDisplayName({ email: null, user_metadata: null })).toBe("名前未設定");
  });

  it("空白だけの名前は無いものとして扱う", () => {
    expect(resolveDisplayName({ user_metadata: { display_name: "  ", name: "山田" } })).toBe("山田");
  });
});

describe("resolveAvatarUrl", () => {
  it("本人が設定した写真を優先し、なければ Google の写真", () => {
    expect(resolveAvatarUrl({ user_metadata: { avatarUrl: "https://x/a.webp", avatar_url: "https://g/p.jpg" } })).toBe("https://x/a.webp");
    expect(resolveAvatarUrl({ user_metadata: { avatar_url: "https://g/p.jpg" } })).toBe("https://g/p.jpg");
    expect(resolveAvatarUrl({ user_metadata: { picture: "https://g/q.jpg" } })).toBe("https://g/q.jpg");
  });

  it("写真を削除したとき（空文字）は、Google の写真に戻さず「写真なし」にする", () => {
    expect(resolveAvatarUrl({ user_metadata: { avatarUrl: "", avatar_url: "https://g/p.jpg" } })).toBeUndefined();
  });
});
