import { describe, expect, it } from "vitest";
import {
  ASK_LIMIT,
  pickQuestions,
  type VendorAskSnapshot,
} from "./askQuestions";

const EMPTY: VendorAskSnapshot = {
  paymentMethods: [],
  rainPolicy: "undecided",
  rainAnswered: false,
  weekly: null,
};

/** 急ぎの質問がすべて答え済みの状態 */
const URGENT_DONE: VendorAskSnapshot = {
  businessHoursStart: "8:00",
  businessHoursEnd: "15:00",
  signatureProduct: { name: "トマト", imageUrl: "https://example.com/a.webp", description: "甘い" },
  paymentMethods: ["cash"],
  instagram: "@yamada",
  website: "https://example.com",
  rainPolicy: "outdoor",
  rainAnswered: true,
  weekly: { isOpen: true, products: ["トマト"] },
};

const ids = (snapshot: VendorAskSnapshot, skippedIds: Parameters<typeof pickQuestions>[1] = {}) =>
  pickQuestions(snapshot, skippedIds).map((question) => question.id);

describe("pickQuestions", () => {
  it("何も入力されていなければ、いつもの質問を先頭に上限の3つまで返す", () => {
    const picked = ids(EMPTY);
    expect(picked).toHaveLength(ASK_LIMIT);
    expect(picked).toEqual(["weekly-products", "hours", "signature"]);
  });

  it("今週の商品に答え済みなら、いつもの質問は出さない", () => {
    const picked = ids({ ...EMPTY, weekly: { isOpen: null, products: ["トマト"] } });
    expect(picked).toEqual(["hours", "signature", "payment"]);
  });

  it("看板商品が未登録のうちは、商品のPRを聞かない", () => {
    expect(ids(EMPTY, { limit: 20 })).not.toContain("signature-pr");
  });

  it("看板商品が登録されていて紹介文が無ければ、商品のPRを聞く", () => {
    const picked = ids(
      {
        ...EMPTY,
        signatureProduct: { name: "トマト", imageUrl: "https://example.com/a.webp" },
      },
      { limit: 20 }
    );
    expect(picked).toContain("signature-pr");
    expect(picked).not.toContain("signature");
  });

  it("雨の日は、答えたと記録されるまで聞く（既定値の「当日判断」のままでは答え済みにしない）", () => {
    expect(ids(EMPTY, { limit: 20 })).toContain("rain");
    expect(ids({ ...EMPTY, rainAnswered: true }, { limit: 20 })).not.toContain("rain");
  });

  it("看板商品は、名前が決まっていて写真があれば答え済み。名前だけでは写真を聞き直す", () => {
    const named = { ...EMPTY, signatureProduct: { name: "トマト" } };
    expect(ids(named, { limit: 20 })).toContain("signature");
    const withPhoto = {
      ...EMPTY,
      signatureProduct: { name: "トマト", imageUrl: "https://example.com/a.webp" },
    };
    expect(ids(withPhoto, { limit: 20 })).not.toContain("signature");
  });

  it("支払方法は、選択肢か自由入力のどちらかがあれば答え済み", () => {
    expect(ids({ ...EMPTY, paymentMethods: ["cash"] }, { limit: 20 })).not.toContain("payment");
    expect(ids({ ...EMPTY, paymentNote: "現金のみ" }, { limit: 20 })).not.toContain("payment");
  });

  it("急ぎが残っているあいだは、マニアックな質問を出さない", () => {
    const picked = ids({ ...URGENT_DONE, website: undefined }, { limit: 20 });
    expect(picked).toEqual(["website"]);
  });

  it("急ぎがすべて片付いたら、マニアックな質問を1つだけ出す", () => {
    expect(ids(URGENT_DONE, { limit: 20 })).toEqual(["strength"]);
  });

  it("「あとで」にした質問は出し直さない", () => {
    const picked = ids(EMPTY, { skippedIds: ["weekly-products", "hours"] });
    expect(picked).toEqual(["signature", "payment", "instagram"]);
  });

  it("急ぎを「あとで」にしたら、その分は数えずにマニアックへ進める", () => {
    const skippedIds = ["website"] as const;
    expect(ids({ ...URGENT_DONE, website: undefined }, { skippedIds })).toEqual(["strength"]);
  });

  it("allowManiac が false なら、急ぎが片付いてもマニアックな質問を出さない", () => {
    expect(ids(URGENT_DONE, { allowManiac: false })).toEqual([]);
  });

  it("すべて答え済みなら空を返す", () => {
    const all: VendorAskSnapshot = {
      ...URGENT_DONE,
      strength: "あ",
      motivation: "い",
      yearsRunning: 10,
      sundayLove: "う",
    };
    expect(ids(all)).toEqual([]);
  });

  it("年数は0年でも答え済みとして扱う", () => {
    expect(ids({ ...URGENT_DONE, strength: "あ", motivation: "い", sundayLove: "う", yearsRunning: 0 })).toEqual([]);
  });
});
