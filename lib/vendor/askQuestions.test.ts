import { describe, expect, it } from "vitest";
import {
  ASK_GROUPS,
  ASK_LIMIT,
  ASK_QUESTIONS,
  emptyAnswerFor,
  isClearAnswer,
  isClearable,
  pickQuestions,
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

  it("編集画面だけの質問（profile）は、トップでは聞かない", () => {
    const picked = ids(EMPTY, { limit: 50 });
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
  it("つながりと店舗写真だけが消せて、空の答えが作れる", () => {
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
