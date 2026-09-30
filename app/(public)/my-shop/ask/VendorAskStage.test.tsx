import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import VendorAskStage from "./VendorAskStage";

const fetchAskSnapshot = vi.fn();

vi.mock("@/app/vendor/_services/askService", () => ({
  AskUserFacingError: class extends Error {},
  fetchAskSnapshot: (...args: unknown[]) => fetchAskSnapshot(...args),
  saveAskAnswer: vi.fn().mockResolvedValue(undefined),
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

async function renderStage(snapshot: VendorAskSnapshot) {
  fetchAskSnapshot.mockResolvedValue(snapshot);
  render(<VendorAskStage vendorId="v1" />);
  await act(async () => {
    await Promise.resolve();
  });
}

const badge = () => screen.queryByRole("button", { name: /にちよさんの質問に答える/ });

describe("VendorAskStage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchAskSnapshot.mockReset();
  });

  it("聞くことが無いときは「！」を出さず、決まったひとことだけ言う", async () => {
    await renderStage(FULL);

    expect(badge()).not.toBeInTheDocument();
    expect(screen.getByText("今日もおつかれさま！")).toBeInTheDocument();
  });

  it("聞くことがあっても、「！」を押すまでは質問を始めない", async () => {
    await renderStage({ ...FULL, instagram: undefined, website: undefined });

    expect(badge()).toHaveAccessibleName("にちよさんの質問に答える（2つ）");
    expect(screen.getByTestId("vendor-ask-badge-count")).toHaveTextContent("2");
    expect(screen.queryByText(/インスタグラム/)).not.toBeInTheDocument();

    fireEvent.click(badge()!);

    expect(screen.getByText(/インスタグラム/)).toBeInTheDocument();
    expect(badge()).not.toBeInTheDocument();
  });

  it("途中でやめると待っている状態に戻り、「！」からまた聞ける", async () => {
    await renderStage({ ...FULL, instagram: undefined });

    fireEvent.click(badge()!);
    fireEvent.click(screen.getByRole("button", { name: /今は答えん/ }));

    expect(screen.queryByText(/インスタグラム/)).not.toBeInTheDocument();
    expect(badge()).toHaveAccessibleName("にちよさんの質問に答える（1つ）");
  });

  it("「あとで」で全部送ると、お礼を言って「！」を消す", async () => {
    await renderStage({ ...FULL, instagram: undefined });

    fireEvent.click(badge()!);
    fireEvent.click(screen.getByRole("button", { name: "あとで" }));

    expect(screen.getByText("ありがとう！お客さんにもよう伝わるき。")).toBeInTheDocument();
    expect(badge()).not.toBeInTheDocument();
  });
});
