import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import StoryGridClient from "./StoryGridClient";
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

// シートの開閉アニメーションを待たずに結果を確かめるため、動きを減らす設定で描く
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
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

const STORIES = [
  makeStory({ id: "a", vendor: { id: "v1", shop_name: "八百屋A", shop_image_url: null, store_number: 1 } }),
  makeStory({ id: "b", vendor: { id: "v2", shop_name: "八百屋B", shop_image_url: null, store_number: 2 } }),
];

function mockViewport({ desktop }: { desktop: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
  );
}

async function renderPage(stories: StoryItem[] = STORIES) {
  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    return {
      ok: true,
      json: async () => (url.includes("/api/stories") ? stories : {}),
    } as Response;
  });
  render(<StoryGridClient />);
  // /api/stories のフェッチ完了を待つ
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("StoryGridClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("スマホでは最新の投稿が半開きのシートで出て、タップすると全画面で再生が始まる", async () => {
    mockViewport({ desktop: false });
    await renderPage();

    fireEvent.click(screen.getByTestId("story-peek-sheet"));

    // 全画面ビューア（ハートの操作を持つ）が先頭の投稿で開く
    expect(await screen.findByLabelText("ハートを送る")).toBeInTheDocument();
  });

  it("シートの閉じるを押すと、シートが消えて一覧だけになる", async () => {
    mockViewport({ desktop: false });
    await renderPage();

    const sheet = screen.getByTestId("story-peek-sheet");
    fireEvent.click(sheet.querySelector('[aria-label="閉じる"]') as HTMLElement);

    expect(screen.queryByTestId("story-peek-sheet")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ハートを送る")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "八百屋Bの投稿を見る" })).toBeInTheDocument();
  });

  it("PC の幅ではシートを出さない（一覧の横に表紙が出る）", async () => {
    mockViewport({ desktop: true });
    await renderPage();

    expect(screen.queryByTestId("story-peek-sheet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "八百屋Aの近況を再生" })).toBeInTheDocument();
  });

  it("?content= 付きで開いたときは、シートを出さずにその投稿を全画面で開く", async () => {
    mockViewport({ desktop: false });
    window.history.replaceState(null, "", "/story?content=b");
    await renderPage();

    expect(screen.queryByTestId("story-peek-sheet")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("ハートを送る")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "八百屋Bをマップで見る" })).toBeInTheDocument();
  });

  it("店の列から選ぶと、その店のいちばん新しい投稿から開く", async () => {
    mockViewport({ desktop: true });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "八百屋Bの近況を見る" }));

    expect(await screen.findByRole("link", { name: "八百屋Bをマップで見る" })).toBeInTheDocument();
  });
});
