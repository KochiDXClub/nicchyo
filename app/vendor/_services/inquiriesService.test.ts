import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createInquiry,
  fetchMyInquiries,
  needsLogin,
  VendorInquiryRequestError,
} from "./inquiriesService";

vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({}) }));

function errorResponse(status: number, body: Record<string, unknown>): Response {
  return {
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response;
}

const validInput = {
  topic: "question",
  category: "operator",
  urgency: "normal",
  body: "テスト",
} as const;

describe("APIのエラー文言", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("401の英語の文言は、日本語に置き換える", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(401, { error: "Unauthorized" }));
    await expect(fetchMyInquiries()).rejects.toThrow(/ログイン/);
    await expect(fetchMyInquiries()).rejects.not.toThrow(/Unauthorized/);
  });

  it("404の英語の文言は、日本語に置き換える", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(404, { error: "Not found" }));
    await expect(fetchMyInquiries()).rejects.toThrow("この連絡は見つかりませんでした。");
  });

  it("429は、レート制限が返す message を優先する", async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(429, { error: "Too Many Requests", message: "送信が多すぎます。5分後にお試しください。" })
    );
    await expect(createInquiry(validInput)).rejects.toThrow("送信が多すぎます。5分後にお試しください。");
  });

  it("429で message が無ければ、既定の日本語を出す", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(429, { error: "Too Many Requests" }));
    await expect(createInquiry(validInput)).rejects.not.toThrow(/Too Many Requests/);
  });

  it("APIが日本語の error を返すときは、そのまま使う", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(400, { error: "許可されていない画像URLです" }));
    await expect(createInquiry(validInput)).rejects.toThrow("許可されていない画像URLです");
  });

  it("本文が読めなくても、ステータスごとの日本語を出す", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    await expect(fetchMyInquiries()).rejects.toThrow(/しばらく/);
  });

  it("ステータスを持つエラーとして投げる", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(401, { error: "Unauthorized" }));
    await expect(fetchMyInquiries()).rejects.toBeInstanceOf(VendorInquiryRequestError);
  });
});

describe("needsLogin", () => {
  it("401のときだけ true", () => {
    expect(needsLogin(new VendorInquiryRequestError("x", 401))).toBe(true);
    expect(needsLogin(new VendorInquiryRequestError("x", 403))).toBe(false);
    expect(needsLogin(new Error("x"))).toBe(false);
    expect(needsLogin(null)).toBe(false);
  });
});
