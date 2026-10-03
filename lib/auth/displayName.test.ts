import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const STORAGE = "https://abc.supabase.co/storage/v1/object/public/user-avatars/u1/avatar-1.webp";

describe("resolveAvatarUrl", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co"));
  afterEach(() => vi.unstubAllEnvs());

  it("本人が設定した写真を優先し、なければ Google の写真", () => {
    expect(resolveAvatarUrl({ user_metadata: { avatarUrl: STORAGE, avatar_url: "https://lh3.googleusercontent.com/p.jpg" } })).toBe(STORAGE);
    expect(resolveAvatarUrl({ user_metadata: { avatar_url: "https://lh3.googleusercontent.com/p.jpg" } })).toBe("https://lh3.googleusercontent.com/p.jpg");
    expect(resolveAvatarUrl({ user_metadata: { picture: "https://lh3.googleusercontent.com/q.jpg" } })).toBe("https://lh3.googleusercontent.com/q.jpg");
  });

  it("写真を削除したとき（空文字）は、Google の写真に戻さず「写真なし」にする", () => {
    expect(resolveAvatarUrl({ user_metadata: { avatarUrl: "", avatar_url: "https://lh3.googleusercontent.com/p.jpg" } })).toBeUndefined();
  });

  it("このサイトの user-avatars と Google の写真以外の URL は、写真なしにする（外部のトラッキング用 URL を出さない）", () => {
    for (const url of [
      "https://evil.example.com/pixel.gif",
      "http://abc.supabase.co/storage/v1/object/public/user-avatars/u1/a.webp", // https でない
      "https://abc.supabase.co/storage/v1/object/public/vendor-images/v1/a.webp", // 別のバケット
      "https://other.supabase.co/storage/v1/object/public/user-avatars/u1/a.webp", // 別のプロジェクト
      "https://abc.supabase.co.evil.example.com/storage/v1/object/public/user-avatars/u1/a.webp",
      "https://user:pw@lh3.googleusercontent.com/p.jpg",
      "https://lh3.googleusercontent.com.evil.example.com/p.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
    ]) {
      expect(resolveAvatarUrl({ user_metadata: { avatarUrl: url } }), url).toBeUndefined();
    }
  });

  it("本人の設定が許されない URL のときは、Google の写真には戻さず写真なしにする", () => {
    expect(resolveAvatarUrl({ user_metadata: { avatarUrl: "https://evil.example.com/x.png", avatar_url: "https://lh3.googleusercontent.com/p.jpg" } })).toBeUndefined();
  });

  it("Storage のホストが分からない環境では、Google の写真だけ許す", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(resolveAvatarUrl({ user_metadata: { avatarUrl: STORAGE } })).toBeUndefined();
    expect(resolveAvatarUrl({ user_metadata: { avatar_url: "https://lh3.googleusercontent.com/p.jpg" } })).toBe("https://lh3.googleusercontent.com/p.jpg");
  });
});
