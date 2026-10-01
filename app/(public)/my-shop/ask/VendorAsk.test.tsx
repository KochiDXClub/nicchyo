import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import VendorAskStage from "./VendorAskStage";
import VendorAskSession from "./VendorAskSession";
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
    expect(screen.getByRole("combobox", { name: "開始時間" })).toHaveValue("7:00");
    // 何から変わるのか分かるよう、いまの登録内容も出す
    expect(card).toHaveTextContent("いまは：06:00〜14:00");
    // 確かめているあいだは、問い合わせ先を出さない
    expect(screen.queryByRole("link", { name: /運営に問い合わせる/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "終了時間" }), { target: { value: "14:00" } });
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
    expect(history[1].text).toContain("保存した");
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

describe("VendorAskSession（質問ページ）", () => {
  beforeEach(() => {
    fetchAskSnapshot.mockReset();
    saveAskAnswer.mockReset();
    saveAskAnswer.mockResolvedValue(undefined);
  });

  it("入力が要る質問を順に聞き、「×」で出店者トップへ戻れる", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined, website: undefined });

    expect(screen.getByText(/インスタグラム/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /のこり 2つ/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "質問をやめて戻る" })).toHaveAttribute("href", "/my-shop");
  });

  it("「あとで」にすると次の質問へ進み、聞き終わったら、また今度聞くと伝える", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined });

    fireEvent.click(screen.getByRole("button", { name: "あとで" }));

    expect(screen.getByText("ありがとう！あとにしたのは、また今度聞かせてや。")).toBeInTheDocument();
    expect(saveAskAnswer).not.toHaveBeenCalled();
  });

  it("入力が要る質問が無ければ、聞くことは無いと伝えて戻る道を出す", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, FULL);

    expect(screen.getByText("今は聞くことないき、ゆっくりしいや。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "もどる" })).toHaveAttribute("href", "/my-shop");
  });

  it("「のこり」を押すと質問の一覧が開き、選んだ質問へ飛べる。「あとで」にしても数は減らない", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined, website: undefined });

    fireEvent.click(screen.getByRole("button", { name: "あとで" }));
    // あとでにしても、入力が要る質問の数はそのまま
    const toggle = screen.getByRole("button", { name: /のこり 2つ/ });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const instagramItem = screen.getByRole("button", { name: /インスタグラム.*あとで/ });
    fireEvent.click(instagramItem);

    // あとでにした質問を選ぶと、また聞く
    expect(screen.getByText(/インスタグラムをやっちょったら/, { selector: "p" })).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("答えると保存して、保存後の状態から次の質問へ進む", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined, website: undefined });
    fetchAskSnapshot.mockResolvedValueOnce({ ...FULL, website: undefined });

    fireEvent.change(screen.getByRole("textbox", { name: "インスタグラムのID" }), { target: { value: "@shop" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    expect(saveAskAnswer).toHaveBeenCalledWith("v1", expect.any(String), expect.objectContaining({ id: "instagram" }));
    expect(screen.getByRole("textbox", { name: "webサイトのURL" })).toBeInTheDocument();
    // 次の質問に進んだら、質問の吹き出しへフォーカスを移す
    expect(screen.getByText(/webサイト/, { selector: "p" }).parentElement).toHaveFocus();
  });

  it("読めば対処できる理由で保存できなかったときは、その理由を出して同じ質問にとどまる", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined });
    saveAskAnswer.mockRejectedValueOnce(new MockAskUserFacingError("先に看板商品を登録してください"));

    fireEvent.change(screen.getByRole("textbox", { name: "インスタグラムのID" }), { target: { value: "@shop" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("先に看板商品を登録してください");
    expect(screen.getByRole("textbox", { name: "インスタグラムのID" })).toBeInTheDocument();
  });

  it("保存できたあと読み直しだけ失敗したら、保存できなかったとは言わずに先へ進む", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined, website: undefined });
    fetchAskSnapshot.mockRejectedValueOnce(new Error("offline"));

    fireEvent.change(screen.getByRole("textbox", { name: "インスタグラムのID" }), { target: { value: "@shop" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("保存はできたけど");
    expect(screen.getByRole("textbox", { name: "webサイトのURL" })).toBeInTheDocument();
  });

  it("聞き終わっても「あとで」にした質問が残っていれば、この回のうちに答えられる", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, { ...FULL, instagram: undefined });

    fireEvent.click(screen.getByRole("button", { name: "あとで" }));
    expect(screen.getByRole("button", { name: /のこり 1つ/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "あとにした質問に答える" }));

    expect(screen.getByRole("textbox", { name: "インスタグラムのID" })).toBeInTheDocument();
  });

  it("h1 で、どのページにいるかを伝える", async () => {
    await renderWith(<VendorAskSession vendorId="v1" />, FULL);
    expect(screen.getByRole("heading", { level: 1, name: "にちよさんからの質問" })).toBeInTheDocument();
  });
});

describe("countLabel", () => {
  it("9までは「つ」、10からは「こ」で数える", () => {
    expect(countLabel(3)).toBe("3つ");
    expect(countLabel(11)).toBe("11こ");
  });
});
