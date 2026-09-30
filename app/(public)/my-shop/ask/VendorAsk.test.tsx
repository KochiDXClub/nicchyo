import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import VendorAskStage from "./VendorAskStage";
import VendorAskSession from "./VendorAskSession";

const fetchAskSnapshot = vi.fn();
const saveAskAnswer = vi.fn();

vi.mock("@/app/vendor/_services/askService", () => ({
  AskUserFacingError: class extends Error {},
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

const inbox = () => screen.queryByRole("link", { name: /にちよさんからの質問に答える/ });

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

    // 1回に聞く数の上限（3つ）ではなく、入力が要る質問の数（急ぎ2つ＋マニアック3つ）
    expect(inbox()).toHaveAccessibleName("にちよさんからの質問に答える（5つ）");
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
    expect(screen.getByText("のこり 2つ")).toBeInTheDocument();
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
});
