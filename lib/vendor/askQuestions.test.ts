import { describe, expect, it } from "vitest";
import {
  ASK_GROUPS,
  ASK_QUESTIONS,
  emptyAnswerFor,
  isClearAnswer,
  isClearable,
  pendingQuestions,
  studioQuestions,
  type VendorAskSnapshot,
} from "./askQuestions";

const EMPTY: VendorAskSnapshot = {
  categoryOptions: [],
  styleTags: [],
  ownerNamePublic: false,
  products: [],
  schedule: [],
  paymentMethods: [],
  rainPolicy: "undecided",
  rainAnswered: false,
  weekly: null,
};

/** 急ぎの質問がすべて答え済みの状態 */
const URGENT_DONE: VendorAskSnapshot = {
  ...EMPTY,
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

const ids = (snapshot: VendorAskSnapshot) => pendingQuestions(snapshot).map((question) => question.id);

describe("pendingQuestions", () => {
  it("いつもの質問 → 急ぎ → マニアックの順に、入力が要る質問をすべて返す", () => {
    const picked = ids(EMPTY);
    expect(picked.slice(0, 3)).toEqual(["weekly-products", "hours", "signature"]);
    expect(picked.slice(-4)).toEqual(["strength", "motivation", "years", "sunday-love"]);
  });

  it("今週の商品に答え済みなら、いつもの質問は出さない", () => {
    const picked = ids({ ...EMPTY, weekly: { isOpen: null, products: ["トマト"] } });
    expect(picked).not.toContain("weekly-products");
    expect(picked[0]).toBe("hours");
  });

  it("看板商品が未登録のうちは、商品のPRを聞かない", () => {
    expect(ids(EMPTY)).not.toContain("signature-pr");
  });

  it("看板商品が登録されていて紹介文が無ければ、商品のPRを聞く", () => {
    const picked = ids({
      ...EMPTY,
      signatureProduct: { name: "トマト", imageUrl: "https://example.com/a.webp" },
    });
    expect(picked).toContain("signature-pr");
    expect(picked).not.toContain("signature");
  });

  it("雨の日は、答えたと記録されるまで聞く（既定値の「当日判断」のままでは答え済みにしない）", () => {
    expect(ids(EMPTY)).toContain("rain");
    expect(ids({ ...EMPTY, rainAnswered: true })).not.toContain("rain");
  });

  it("看板商品は、名前が決まっていて写真があれば答え済み。名前だけでは写真を聞き直す", () => {
    expect(ids({ ...EMPTY, signatureProduct: { name: "トマト" } })).toContain("signature");
    const withPhoto = {
      ...EMPTY,
      signatureProduct: { name: "トマト", imageUrl: "https://example.com/a.webp" },
    };
    expect(ids(withPhoto)).not.toContain("signature");
  });

  it("支払方法は、選択肢か自由入力のどちらかがあれば答え済み", () => {
    expect(ids({ ...EMPTY, paymentMethods: ["cash"] })).not.toContain("payment");
    expect(ids({ ...EMPTY, paymentNote: "現金のみ" })).not.toContain("payment");
  });

  it("急ぎが残っていても、マニアックな質問はそのあとに並べて数に入れる", () => {
    expect(ids({ ...URGENT_DONE, website: undefined })).toEqual([
      "website",
      "strength",
      "motivation",
      "years",
      "sunday-love",
    ]);
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

  it("編集画面だけの質問（profile）は、トップでは聞かない", () => {
    const picked = ids(EMPTY);
    const profileIds = ASK_QUESTIONS.filter((q) => q.tier === "profile").map((q) => q.id);
    expect(profileIds.length).toBeGreaterThan(0);
    for (const id of profileIds) expect(picked).not.toContain(id);
  });
});

describe("編集画面の章立て", () => {
  it("すべての質問が、ちょうど1つの章に入っている", () => {
    const placed = ASK_GROUPS.flatMap((group) => [...group.ids]);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(ASK_QUESTIONS.map((q) => q.id).sort());
  });

  it("聞く意味の無い質問（看板商品が無いときの商品PR）は章から外れる", () => {
    const all = studioQuestions(EMPTY).flatMap((group) => group.questions.map((q) => q.id));
    expect(all).not.toContain("signature-pr");
    const withSignature = studioQuestions({ ...EMPTY, signatureProduct: { name: "トマト" } }).flatMap(
      (group) => group.questions.map((q) => q.id)
    );
    expect(withSignature).toContain("signature-pr");
  });
});

describe("答えの要約", () => {
  const summaryOf = (id: string, snapshot: VendorAskSnapshot) =>
    ASK_QUESTIONS.find((q) => q.id === id)!.summary(snapshot);

  it("答えが無ければ、どの質問も null を返す", () => {
    for (const question of ASK_QUESTIONS) {
      if (question.id === "signature-pr") continue;
      expect(question.summary(EMPTY)).toBeNull();
    }
  });

  it("答え済みの質問は、isAnswered と要約の有無が食い違わない", () => {
    const full: VendorAskSnapshot = {
      ...URGENT_DONE,
      shopName: "山田農園",
      shopImageUrl: "https://example.com/store-main.webp",
      categoryId: "c1",
      categoryName: "食材",
      styleTags: ["試食あり"],
      ownerName: "山田",
      products: [{ name: "トマト", price: 300 }],
      schedule: ["毎週日曜日"],
      snsX: "@yamada",
      strength: "あ",
      motivation: "い",
      yearsRunning: 0,
      sundayLove: "う",
    };
    for (const question of ASK_QUESTIONS) {
      expect(question.isAnswered(full)).toBe(true);
      expect(question.summary(full)).not.toBeNull();
    }
  });

  it("商品は値段つきで並べ、多いときは「ほか◯件」で切る", () => {
    const products = ["A", "B", "C", "D", "E"].map((name, i) => ({ name, price: (i + 1) * 100 }));
    expect(summaryOf("products", { ...EMPTY, products })).toBe("A ¥100、B ¥200、C ¥300 ほか2件");
    expect(summaryOf("products", { ...EMPTY, products: [{ name: "トマト", price: null }] })).toBe("トマト");
  });

  it("支払方法は、選択肢の名前と自由入力を並べる", () => {
    expect(
      summaryOf("payment", { ...EMPTY, paymentMethods: ["cash", "paypay"], paymentNote: "QUOカード" })
    ).toBe("現金・PayPay・QUOカード");
  });

  it("店主名は、公開するかどうかも添える", () => {
    expect(summaryOf("owner", { ...EMPTY, ownerName: "山田", ownerNamePublic: true })).toBe("山田（公開）");
    expect(summaryOf("owner", { ...EMPTY, ownerName: "山田", ownerNamePublic: false })).toBe("山田（非公開）");
  });
});

describe("答えを消す", () => {
  it("つながり・店舗写真・店主名・ジャンルが消せて、空の答えが作れる", () => {
    expect(isClearable("instagram")).toBe(true);
    expect(isClearable("shop-photo")).toBe(true);
    expect(isClearable("hours")).toBe(false);
    expect(emptyAnswerFor("website")).toEqual({ id: "website", value: "" });
    expect(emptyAnswerFor("shop-photo")).toEqual({ id: "shop-photo", imageFile: null });
    expect(emptyAnswerFor("hours")).toBeNull();
  });

  it("消せる質問の空の答えは、どれも「消した」と判定される（ほめない）", () => {
    for (const question of ASK_QUESTIONS.filter((q) => isClearable(q.id))) {
      const empty = emptyAnswerFor(question.id);
      expect(empty).not.toBeNull();
      expect(isClearAnswer(empty!)).toBe(true);
    }
    expect(isClearAnswer({ id: "owner", name: "山田", isPublic: true })).toBe(false);
    expect(isClearAnswer({ id: "category", categoryId: "c1" })).toBe(false);
  });
});
