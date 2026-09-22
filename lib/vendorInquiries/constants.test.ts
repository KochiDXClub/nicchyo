import { describe, expect, it } from "vitest";
import {
  VENDOR_INQUIRY_CATEGORIES,
  VENDOR_INQUIRY_STATUS_BY_TOPIC,
  VENDOR_INQUIRY_TOPICS,
  VENDOR_INQUIRY_URGENCIES,
  isAllowedVendorInquiryImageUrl,
  isUuid,
  isValidStatusForTopic,
  isVendorInquiryCategory,
  isVendorInquiryStatus,
  isVendorInquiryTopic,
  isVendorInquiryUrgency,
} from "./constants";

describe("isUuid", () => {
  it("UUIDを通す", () => {
    expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
  });

  it.each(["foo", "", "3f2504e0-4f89-11d3-9a0c", "3f2504e04f8911d39a0c0305e82c3301", "../../etc/passwd"])(
    "UUIDでない %s は拒否する",
    (input) => {
      expect(isUuid(input)).toBe(false);
    }
  );
});

describe("isAllowedVendorInquiryImageUrl", () => {
  // 本番と同じく「このプロジェクトのSupabaseホストだけ」を許可する設定で確かめる
  const HOST = "xyz.supabase.co";
  const allowed = (value: string) => isAllowedVendorInquiryImageUrl(value, HOST);

  it("サイト内の絶対パスを許可する", () => {
    expect(allowed("/images/a.png")).toBe(true);
  });

  it("このプロジェクトのSupabase Storage の https URL を許可する", () => {
    expect(allowed(`https://${HOST}/storage/v1/object/public/a.png`)).toBe(true);
  });

  it.each([
    "//evil.example/a.png",
    // ブラウザが `/\` を `//` に正規化するため、プロトコル相対URLと同じく外部ホストを指す
    "/\\evil.example/a.png",
    // ブラウザはURL解釈の前にタブ・LF・CRを取り除くので、これらも `//evil.example/...` になる。
    // .trim() は前後しか落とさないため、途中の制御文字は別途弾く必要がある
    "/\t/evil.example/a.png",
    "/\n/evil.example/a.png",
    "/\r/evil.example/a.png",
    "http://example.com/a.png",
    "javascript:alert(1)",
    "https://evil.com/a.png",
    // 他人のSupabaseプロジェクト。*.supabase.co をまるごと許すと通ってしまう
    "https://other-project.supabase.co/storage/v1/object/public/a.png",
    // ユーザー情報でホストを偽装する形
    "https://evil.com\\@xyz.supabase.co/a.png",
    "",
    "   ",
  ])("許可外の %s は拒否する", (input) => {
    expect(allowed(input)).toBe(false);
  });

  it("長すぎるURLは拒否する", () => {
    expect(allowed(`/images/${"a".repeat(2048)}.png`)).toBe(false);
  });

  it("Supabaseのホストが分からないときはhttpsのURLを一切許可しない", () => {
    expect(isAllowedVendorInquiryImageUrl(`https://${HOST}/a.png`, null)).toBe(false);
    // サイト内パスは影響を受けない
    expect(isAllowedVendorInquiryImageUrl("/images/a.png", null)).toBe(true);
  });
});

describe("isValidStatusForTopic", () => {
  it.each([
    ["report", "unconfirmed", true],
    ["report", "confirmed", true],
    ["report", "ai_pending", false],
    ["consultation", "in_progress", true],
    ["consultation", "confirmed", false],
    ["question", "ai_pending", true],
    ["question", "resolved", false],
  ] as const)("topic=%s, status=%s -> %s", (topic, status, expected) => {
    expect(isValidStatusForTopic(topic, status)).toBe(expected);
  });
});

// 一覧APIのフィルタは fail-closed（不正な値は400）なので、
// これらの判定が緩むと「絞り込んだつもりで全件返る」ことになる
describe("フィルタ用の値チェック", () => {
  it("topic", () => {
    expect(VENDOR_INQUIRY_TOPICS.every(isVendorInquiryTopic)).toBe(true);
    expect(isVendorInquiryTopic("bogus")).toBe(false);
    expect(isVendorInquiryTopic("")).toBe(false);
  });

  it("category", () => {
    expect(VENDOR_INQUIRY_CATEGORIES.every(isVendorInquiryCategory)).toBe(true);
    expect(isVendorInquiryCategory("bogus")).toBe(false);
  });

  it("urgency", () => {
    expect(VENDOR_INQUIRY_URGENCIES.every(isVendorInquiryUrgency)).toBe(true);
    expect(isVendorInquiryUrgency("bogus")).toBe(false);
  });

  it("status は全topicの値を受け付け、それ以外は弾く", () => {
    for (const status of Object.values(VENDOR_INQUIRY_STATUS_BY_TOPIC).flat()) {
      expect(isVendorInquiryStatus(status)).toBe(true);
    }
    expect(isVendorInquiryStatus("bogus")).toBe(false);
    // topicをまたいだ値でも、一覧のフィルタとしては有効な値として扱う
    expect(isVendorInquiryStatus("confirmed")).toBe(true);
  });
});
