import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import StoryGridClient from "./StoryGridClient";
import { LOADING_LANTERN_DURATION_MS } from "./components/LoadingLantern";
import type { StoryItem } from "./types";

// ナビゲーションバーは Auth/Bag/Menu の各 Context に依存するため、
// このテストの対象外としてスタブに差し替える
vi.mock("@/app/components/NavigationBar", () => ({
  default: () => <div data-testid="navigation-bar-stub" />,
}));

vi.mock("@/lib/story/reactions", () => ({
  fetchReactionCounts: vi.fn().mockResolvedValue({ counts: {}, reactedIds: [] }),
  fetchReactionState: vi.fn().mockResolvedValue({ count: 0, reacted: false }),
  toggleReaction: vi.fn().mockResolvedValue({ count: 1, reacted: true }),
}));

function makeStory(overrides: Partial<StoryItem>): StoryItem {
  return {
    id: "id",
    body: null,
    image_url: "https://example.supabase.co/storage/v1/object/public/stories/x.jpg",
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: new Date().toISOString(), // 「今週」扱い
    vendor: { id: "v", shop_name: "出店者", shop_image_url: null, store_number: 1 },
    ...overrides,
  };
}

describe("StoryGridClient のプレビュー枠（FeaturedStoryPreview）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("今週の投稿を自動送りし、一定時間ごとに次の投稿へ切り替わる", async () => {
    const stories = [
      makeStory({ id: "a", vendor: { id: "v1", shop_name: "八百屋A", shop_image_url: null, store_number: 1 } }),
      makeStory({ id: "b", vendor: { id: "v2", shop_name: "八百屋B", shop_image_url: null, store_number: 2 } }),
    ];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => stories,
    } as Response);

    render(<StoryGridClient />);

    // 提灯ローディングの表示時間を経過させる
    await act(async () => {
      vi.advanceTimersByTime(LOADING_LANTERN_DURATION_MS);
    });
    // /api/stories のフェッチ完了を待つ
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("八百屋A")).toBeInTheDocument();

    // プレビュー枠の自動送り（4秒）で次の投稿に切り替わる
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText("八百屋B")).toBeInTheDocument();
    expect(screen.queryByText("八百屋A")).not.toBeInTheDocument();
  });

  it("プレビュー枠をタップすると、その投稿から全画面ビューアが開く", async () => {
    const stories = [
      makeStory({ id: "a", vendor: { id: "v1", shop_name: "八百屋A", shop_image_url: null, store_number: 1 } }),
    ];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => stories,
    } as Response);

    render(<StoryGridClient />);

    await act(async () => {
      vi.advanceTimersByTime(LOADING_LANTERN_DURATION_MS);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const previewButton = screen.getByRole("button", { name: "八百屋Aの近況を全画面で見る" });
    fireEvent.click(previewButton);

    // 全画面ビューア（閉じるボタンを持つ）が開く
    expect(screen.getByLabelText("閉じる")).toBeInTheDocument();
  });
});
