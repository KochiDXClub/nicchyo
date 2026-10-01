import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import VendorAskStage from "./VendorAskStage";
import VendorAskSession from "./VendorAskSession";
import { countLabel } from "./pendingQuestions";

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
