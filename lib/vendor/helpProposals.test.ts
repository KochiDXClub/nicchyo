import { describe, expect, it } from "vitest";
import {
  applyProposalToSnapshot,
  parseProposalFrame,
  proposalFromToolCalls as proposalFromToolCallsWith,
  serializeProposal,
} from "./helpProposals";
import type { VendorAskSnapshot } from "./askQuestions";

/** お店の情報の変更案だけを取り出す。出店者の質問は、値を書かない項目のテストでは空でよい */
const proposalFromToolCalls = (calls: { name: string; arguments: string }[], userText = "") => {
  const proposal = proposalFromToolCallsWith(calls, userText);
  return proposal?.kind === "change" ? proposal.answer : proposal;
};

const call = (name: string, args: unknown) => ({ name, arguments: JSON.stringify(args) });

describe("proposalFromToolCalls", () => {
  it("営業時間は何時ちょうどの選択肢の形にする", () => {
    expect(proposalFromToolCalls([call("propose_hours", { start_hour: 7, end_hour: 13 })])).toEqual({
      id: "hours",
      start: "7:00",
      end: "13:00",
    });
  });

  it("終わりが始まりより前、範囲外の時間は案にしない", () => {
    expect(proposalFromToolCalls([call("propose_hours", { start_hour: 13, end_hour: 7 })])).toBeNull();
    expect(proposalFromToolCalls([call("propose_hours", { start_hour: 3, end_hour: 7 })])).toBeNull();
  });

  it("支払い方法は知っているものだけ、いつもの並びで", () => {
    expect(
      proposalFromToolCalls([call("propose_payment", { methods: ["paypay", "cash"], note: " " })])
    ).toEqual({ id: "payment", methods: ["cash", "paypay"], note: "" });
    expect(proposalFromToolCalls([call("propose_payment", { methods: ["bitcoin"], note: "" })])).toBeNull();
  });

  it("SNS の ID は @ を外し、webサイトは http(s) の URL だけ", () => {
    expect(proposalFromToolCalls([call("propose_link", { kind: "instagram", value: "@tosa_shop" })], "インスタを @tosa_shop にして")).toEqual({
      id: "instagram",
      value: "tosa_shop",
    });
    expect(
      proposalFromToolCalls([call("propose_link", { kind: "website", value: "javascript:alert(1)" })])
    ).toBeNull();
    expect(proposalFromToolCalls([call("propose_link", { kind: "x", value: "<b>" })])).toBeNull();
  });

  it("今週の商品は空や重複を除く", () => {
    expect(
      proposalFromToolCalls([call("propose_weekly_products", { products: ["文旦", " ", "文旦", "生姜"] })])
    ).toEqual({ id: "weekly-products", products: ["文旦", "生姜"] });
  });

  it("知らない関数・壊れた引数は飛ばし、最初に読めた案を使う", () => {
    expect(
      proposalFromToolCalls([
        { name: "delete_shop", arguments: "{}" },
        { name: "propose_text", arguments: "{broken" },
        call("propose_text", { field: "shop-name", text: "土佐の八百屋" }),
        call("propose_rain", { policy: "cancel", note: "" }),
      ], "店名を土佐の八百屋に変えたい")
    ).toEqual({ id: "shop-name", text: "土佐の八百屋" });
    expect(proposalFromToolCalls([{ name: "toString", arguments: "{}" }])).toBeNull();
  });

  it("リンクや店名は、出店者がいま書いた値のときだけ案にする（データに紛れた指示で偽の URL を出させない）", () => {
    const site = [call("propose_link", { kind: "website", value: "https://evil.example/" })];
    expect(proposalFromToolCalls(site, "webサイトを変えたい")).toBeNull();
    expect(proposalFromToolCalls(site, "サイトを evil.example にして")).toEqual({
      id: "website",
      value: "https://evil.example/",
    });
    expect(
      proposalFromToolCalls([call("propose_text", { field: "shop-name", text: "偽の店" })], "店名を変えたい")
    ).toBeNull();
    // 全角で書いても同じ値として扱う
    expect(
      proposalFromToolCalls([call("propose_link", { kind: "x", value: "tosa" })], "Xは ｔｏｓａ です")
    ).toEqual({ id: "x", value: "tosa" });
  });

  it("長すぎる文は案にしない", () => {
    expect(
      proposalFromToolCalls([call("propose_text", { field: "shop-name", text: "あ".repeat(41) })])
    ).toBeNull();
  });
});

describe("自由文の案の確かめ（こだわり・今週の商品・補足）", () => {
  it("出店者が書いていない連絡先やデータの言葉が入った自由文は、案にしない", () => {
    const strength = (text: string) => [call("propose_text", { field: "strength", text })];
    const said = "うちのトマトは朝どれで甘いがよ";

    expect(proposalFromToolCallsWith(strength("朝どれで甘いトマト。予約は 090-1234-5678"), said)).toBeNull();
    expect(
      proposalFromToolCallsWith(strength("朝どれで甘いトマト。いも天もおすすめ"), said, {
        vendorText: said,
        untrustedWords: ["いも天"],
      })
    ).toBeNull();
    expect(
      proposalFromToolCallsWith([call("propose_weekly_products", { products: ["トマト", "いも天"] })], "今週はトマト", {
        untrustedWords: ["いも天"],
      })
    ).toBeNull();
  });

  it("出店者が話したことに基づく自由文は、言い回しが違っても通す", () => {
    const said = "うちのトマトは朝どれで甘いがよ";
    expect(
      proposalFromToolCallsWith([call("propose_text", { field: "strength", text: "朝どれの甘いトマトが自慢です" })], said, {
        untrustedWords: ["いも天", "トマト"],
      })
    ).toMatchObject({ kind: "change", answer: { id: "strength" } });
  });
});

describe("入力欄を開く案（open_field）", () => {
  it("新しい値が無くても、変えたい項目の入力欄を開く案にする", () => {
    expect(proposalFromToolCallsWith([call("open_field", { field: "hours" })], "営業時間を変えたい")).toEqual({
      kind: "edit",
      field: "hours",
    });
  });

  it("写真など、会話から変えない項目は案にしない", () => {
    expect(proposalFromToolCallsWith([call("open_field", { field: "shop-photo" })], "写真を変えたい")).toBeNull();
  });
});

describe("parseProposalFrame", () => {
  it("サーバーが付けた案を読み戻せる", () => {
    const change = { kind: "change", answer: { id: "rain", policy: "undecided", note: "小雨なら出る" } } as const;
    expect(parseProposalFrame(serializeProposal(change))).toEqual(change);
    const edit = { kind: "edit", field: "hours" } as const;
    expect(parseProposalFrame(serializeProposal(edit))).toEqual(edit);
  });

  it("形の違うデータは読まない", () => {
    expect(parseProposalFrame('{"type":"proposal","answer":{"id":"shop-photo"}}')).toBeNull();
    expect(parseProposalFrame("not json")).toBeNull();
  });
});

describe("applyProposalToSnapshot", () => {
  const snapshot = {
    paymentMethods: ["cash"],
    rainPolicy: "undecided",
    rainAnswered: false,
    weekly: { isOpen: true, products: ["文旦"] },
  } as unknown as VendorAskSnapshot;

  it("入力欄が初期値を読む項目に、案を重ねる", () => {
    expect(applyProposalToSnapshot(snapshot, { id: "rain", policy: "cancel", note: "" })).toMatchObject({
      rainPolicy: "cancel",
      rainAnswered: true,
    });
    expect(
      applyProposalToSnapshot(snapshot, { id: "weekly-products", products: ["生姜"] }).weekly
    ).toEqual({ isOpen: true, products: ["生姜"] });
    expect(applyProposalToSnapshot(snapshot, { id: "x", value: "shop" }).snsX).toBe("shop");
  });
});
