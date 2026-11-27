import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import VendorAskStage from "./VendorAskStage";
import { countLabel } from "./countLabel";
import { TEXT_STREAM_DATA_SEPARATOR } from "@/lib/ai/textStream";
import { serializeProposal } from "@/lib/vendor/helpProposals";

const fetchAskSnapshot = vi.fn();
const { MockAskUserFacingError } = vi.hoisted(() => ({ MockAskUserFacingError: class extends Error {} }));
const saveAskAnswer = vi.fn();

vi.mock("@/app/vendor/_services/askService", () => ({
  AskUserFacingError: MockAskUserFacingError,
  fetchAskSnapshot: (...args: unknown[]) => fetchAskSnapshot(...args),
  saveAskAnswer: (...args: unknown[]) => saveAskAnswer(...args),
}));

// にちよさんの絵は見た目だけなので、このテストでは差し替える
vi.mock("@/app/(public)/consult/components/GrandmaAvatar", () => ({
  default: () => <div data-testid="grandma" />,
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

/** すべて答え済みの出店者 */
const FULL: VendorAskSnapshot = {
  // 店舗情報の編集画面だけで聞く項目（トップの数には入らない）
  categoryOptions: [],
  styleTags: [],
  ownerNamePublic: false,
  products: [],
  schedule: [],
  businessHoursStart: "06:00",
  businessHoursEnd: "14:00",
  signatureProduct: { name: "トマト", imageUrl: "https://example.supabase.co/x.webp", description: "甘い" },
  paymentMethods: ["cash"],
  instagram: "@shop",
  website: "https://example.com",
  rainPolicy: "tent",
  rainAnswered: true,
  strength: "新鮮",
  motivation: "楽しい",
  yearsRunning: 10,
  sundayLove: "人",
  weekly: { isOpen: true, products: ["トマト"] },
};

async function renderWith(ui: React.ReactElement, snapshot: VendorAskSnapshot) {
  fetchAskSnapshot.mockResolvedValue(snapshot);
  render(ui);
  await act(async () => {
    await Promise.resolve();
  });
}

const inbox = () => screen.queryByRole("link", { name: /にちよさんからの\s*質問が/ });

describe("VendorAskStage（出店者トップ）", () => {
  beforeEach(() => {
    fetchAskSnapshot.mockReset();
  });

  it("入力が要る質問が無いときは吹き出しを出さず、決まったひとことだけ言う", async () => {
    await renderWith(<VendorAskStage vendorId="v1" />, FULL);

    expect(inbox()).not.toBeInTheDocument();
    expect(screen.getByText("今日もおつかれさま！")).toBeInTheDocument();
  });

  it("入力が要る質問の数をそのまま出し、質問ページへつなぐ（その場では聞かない）", async () => {
    await renderWith(
      <VendorAskStage vendorId="v1" />,
      { ...FULL, instagram: undefined, website: undefined, strength: undefined, motivation: undefined, sundayLove: undefined }
    );

    // 入力が要る質問の数（急ぎ2つ＋マニアック3つ）。見えている「質問が5つ」がそのままリンクの名前になる
    expect(inbox()).toHaveAccessibleName(/にちよさんからの\s*質問が\s*5\s*つ/);
    expect(inbox()).toHaveAttribute("href", "/my-shop/ask");
    expect(screen.getByTestId("vendor-ask-inbox-count")).toHaveTextContent("5");
    expect(screen.queryByText(/インスタグラム/)).not.toBeInTheDocument();
  });
});

describe("VendorAskStage の相談からの変更案", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchAskSnapshot.mockReset();
    saveAskAnswer.mockReset();
    saveAskAnswer.mockResolvedValue(undefined);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function replyWithProposal(text: string) {
    const body =
      text + TEXT_STREAM_DATA_SEPARATOR + serializeProposal({ kind: "change", answer: { id: "hours", start: "7:00", end: "13:00" } });
    fetchMock.mockResolvedValueOnce(new Response(body));
  }

  async function ask(text: string) {
    fireEvent.change(screen.getByRole("textbox", { name: "にちよさんに相談する" }), { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "聞く" }));
    });
  }

  it("変更案を入れた入力欄で確かめてから、保存する（その場で直せる）", async () => {
    await renderWith(<VendorAskStage vendorId="v1" />, FULL);
    replyWithProposal("7時から13時にするがやね。");

    await ask("営業時間を7時から13時にしたい");

    const card = await screen.findByRole("group", { name: "営業時間の変更の確認" });
    expect(screen.getByText("7時から13時にするがやね。")).toBeInTheDocument();
    // 区切りのあとのデータは本文に出さない
    expect(screen.queryByText(/"proposal"/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "開始時間（時）" })).toHaveValue("7");
    expect(screen.getByRole("combobox", { name: "開始時間（分）" })).toHaveValue("0");
    // 何から変わるのか分かるよう、いまの登録内容も出す
    expect(card).toHaveTextContent("いまは：06:00〜14:00");
    // 確かめているあいだは、問い合わせ先を出さない
    expect(screen.queryByRole("link", { name: /運営に問い合わせる/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "終了時間（時）" }), { target: { value: "14" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    expect(saveAskAnswer).toHaveBeenCalledWith("v1", expect.any(String), {
      id: "hours",
      start: "7:00",
      end: "14:00",
    });
    expect(card).not.toBeInTheDocument();
    expect(screen.getByText("営業時間を変えちょいたで！")).toBeInTheDocument();

    // 続けて聞くと、保存したことも AI に伝わる
    fetchMock.mockResolvedValueOnce(new Response("はいよ"));
    await ask("ありがとう");
    const history = JSON.parse(fetchMock.mock.calls[1][1].body).history;
    expect(history[1].text).toContain("営業時間の変更を保存した");
  });

  it("値を言わずに「変えたい」だけでも、いまの値を入れた入力欄を開いて保存できる", async () => {
    // 保存される形（店舗情報の時間の選択肢と同じ「6:00」）
    await renderWith(<VendorAskStage vendorId="v1" />, { ...FULL, businessHoursStart: "6:00", businessHoursEnd: "14:00" });
    fetchMock.mockResolvedValueOnce(
      new Response(TEXT_STREAM_DATA_SEPARATOR + serializeProposal({ kind: "edit", field: "hours" }))
    );

    await ask("営業時間を変えたい");

    await screen.findByRole("group", { name: "営業時間の変更の確認" });
    expect(screen.getByText("ここで変えてや。")).toBeInTheDocument();
    expect(screen.getByText("営業時間、どう変えるかえ？")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "開始時間（時）" })).toHaveValue("6");

    fireEvent.change(screen.getByRole("combobox", { name: "開始時間（時）" }), { target: { value: "7" } });
    fireEvent.change(screen.getByRole("combobox", { name: "終了時間（時）" }), { target: { value: "13" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    expect(saveAskAnswer).toHaveBeenCalledWith("v1", expect.any(String), { id: "hours", start: "7:00", end: "13:00" });
    expect(screen.getByText("営業時間を変えちょいたで！")).toBeInTheDocument();
  });

  it("「やめる」と保存せずに閉じる", async () => {
    await renderWith(<VendorAskStage vendorId="v1" />, FULL);
    replyWithProposal("");

    await ask("営業時間を変えたい");

    // ひとことが無くても、確かめる言葉を出す
    await waitFor(() => expect(screen.getByText("こうでええかえ？")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    expect(saveAskAnswer).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: /変更の確認/ })).not.toBeInTheDocument();
    expect(screen.getByText("ほいたら、そのままにしちょくね。")).toBeInTheDocument();
  });

  it("保存に失敗したら、確認を残したまま知らせる", async () => {
    await renderWith(<VendorAskStage vendorId="v1" />, FULL);
    saveAskAnswer.mockRejectedValueOnce(new Error("network"));
    replyWithProposal("これでどう？");

    await ask("営業時間を変えたい");
    await screen.findByRole("group", { name: "営業時間の変更の確認" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("うまく保存できんかった");
    expect(screen.getByRole("group", { name: "営業時間の変更の確認" })).toBeInTheDocument();
  });
});

describe("VendorAskStage の相談からの「覚えちょいてもかまん？」", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchAskSnapshot.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function replyWithMemory() {
    const body =
      "それはお客さんにも伝えたいねえ。" +
      TEXT_STREAM_DATA_SEPARATOR +
      serializeProposal({ kind: "memory", note: { title: "混む時間", content: "9時ごろがいちばん混む" } });
    fetchMock.mockResolvedValueOnce(new Response(body));
  }

  async function ask(text: string) {
    fireEvent.change(screen.getByRole("textbox", { name: "にちよさんに相談する" }), { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "聞く" }));
    });
  }

  it("直してから覚えさせると、にちよさんのノートに保存する", async () => {
    await renderWith(<VendorAskStage vendorId="v1" />, FULL);
    replyWithMemory();
    await ask("うちは9時ごろが一番混むがよ");

    await screen.findByRole("group", { name: "にちよさんが覚えることの確認" });
    expect(screen.getByRole("textbox", { name: "何の話か（トピックタイトル）" })).toHaveValue("混む時間");
    fireEvent.change(screen.getByRole("textbox", { name: "覚えること" }), {
      target: { value: "9時ごろがいちばん混む。8時台はゆっくり見られる" },
    });

    fetchMock.mockResolvedValueOnce(Response.json({ note: { id: "n1" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/vendor/ai-notes");
    expect(JSON.parse(init.body)).toEqual({
      title: "混む時間",
      content: "9時ごろがいちばん混む。8時台はゆっくり見られる",
      forVisitors: true,
      forVendor: true,
    });
    expect(screen.getByText("覚えちょくね！お客さんに聞かれたら伝えるき。")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /覚えることの確認/ })).not.toBeInTheDocument();
  });

  it("「いらん」なら覚えない。保存できんかったら理由を出して、確認を残す", async () => {
    await renderWith(<VendorAskStage vendorId="v1" />, FULL);
    replyWithMemory();
    await ask("9時ごろが混む");
    await screen.findByRole("group", { name: "にちよさんが覚えることの確認" });

    fetchMock.mockResolvedValueOnce(Response.json({ error: "ノートは50枚までです" }, { status: 400 }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("ノートは50枚までです");

    fireEvent.click(screen.getByRole("button", { name: "いらん" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("わかった、覚えんちょくね。")).toBeInTheDocument();
  });
});

describe("countLabel", () => {
  it("9までは「つ」、10からは「こ」で数える", () => {
    expect(countLabel(3)).toBe("3つ");
    expect(countLabel(11)).toBe("11こ");
  });
});
