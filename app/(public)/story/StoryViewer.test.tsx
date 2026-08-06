import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi } from "vitest";
import StoryViewer from "./StoryViewer";
import type { StoryItem } from "./types";

// ネットワーク越しのハート機能は本テストの対象外なので、常に一定の状態を返すよう固定する
vi.mock("@/lib/story/reactions", () => ({
  fetchReactionState: vi.fn().mockResolvedValue({ count: 0, reacted: false }),
  toggleReaction: vi.fn().mockResolvedValue({ count: 1, reacted: true }),
}));

vi.mock("@/lib/consultVisitorKey", () => ({
  getOrCreateConsultVisitorKey: () => "visitor-test",
}));

function makeStory(overrides: Partial<StoryItem> = {}): StoryItem {
  return {
    id: "story-1",
    body: "きょうの朝どれです",
    image_url: "https://example.supabase.co/storage/v1/object/public/stories/1.jpg",
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: new Date().toISOString(),
    vendor: {
      id: "vendor-1",
      shop_name: "テスト青果店",
      shop_image_url: null,
      store_number: 12,
    },
    ...overrides,
  };
}

// タップ位置の左右判定は container.getBoundingClientRect() を使うため、
// jsdom のデフォルト（幅0）のままだとどちらのタップも同じ扱いになってしまう。
// 固定の幅を持つ矩形を返すようにモックする。
function mockContainerRect(container: HTMLElement) {
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 400,
    bottom: 800,
    width: 400,
    height: 800,
    toJSON() {
      return this;
    },
  });
}

// StoryViewer のルート要素（onPointerDown 等を持つ）を取得する
function getPressSurface(container: HTMLElement) {
  const el = container.firstElementChild as HTMLElement;
  mockContainerRect(el);
  return el;
}

function tap(el: HTMLElement, clientX: number) {
  fireEvent.pointerDown(el, { clientX, clientY: 400, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX, clientY: 400, pointerId: 1 });
}

describe("StoryViewer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("画面右半分をタップすると次の投稿に進む", () => {
    const stories = [makeStory({ id: "a" }), makeStory({ id: "b", vendor: null })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    expect(screen.getByText("テスト青果店")).toBeInTheDocument();

    tap(surface, 300); // 右側（幅400のうち300）

    expect(screen.getByText("出店者")).toBeInTheDocument(); // b は vendor null → デフォルト表示
  });

  it("画面左半分をタップすると前の投稿に戻る", () => {
    const stories = [makeStory({ id: "a" }), makeStory({ id: "b" })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={1} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    tap(surface, 50); // 左側

    // initialIndex=1 から index=0 に戻り、a の商品情報バーが表示される
    expect(onClose).not.toHaveBeenCalled();
  });

  it("最後の投稿で右タップすると閉じる", () => {
    const stories = [makeStory({ id: "a" })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    tap(surface, 300);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("先頭の投稿で左タップしても何も起きない", () => {
    const stories = [makeStory({ id: "a" }), makeStory({ id: "b" })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    tap(surface, 50);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("テスト青果店")).toBeInTheDocument(); // a のまま
  });

  it("長押しすると一時停止インジケーターが表示され、離しても送られない", () => {
    const stories = [makeStory({ id: "a" }), makeStory({ id: "b" })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    // 一時停止インジケーター（矩形2本の「II」アイコン）はまだ出ていない
    expect(container.querySelector("svg rect")).toBeNull();

    fireEvent.pointerDown(surface, { clientX: 300, clientY: 400, pointerId: 1 });

    // 長押し判定のしきい値（220ms）を超えさせる
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // 一時停止インジケーターが表示される
    expect(container.querySelector("svg rect")).not.toBeNull();

    fireEvent.pointerUp(surface, { clientX: 300, clientY: 400, pointerId: 1 });

    // 離すとインジケーターは消える
    expect(container.querySelector("svg rect")).toBeNull();

    // 長押し後に離しても、タップ送りは発生しない（a のまま）
    expect(screen.getByText("テスト青果店")).toBeInTheDocument();
  });

  it("しきい値を超えて指が動くとタップ送りが無効化される（スワイプ扱い）", () => {
    const stories = [makeStory({ id: "a" }), makeStory({ id: "b" })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    fireEvent.pointerDown(surface, { clientX: 300, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 340, clientY: 400, pointerId: 1 }); // 40px 移動 > 許容10px
    fireEvent.pointerUp(surface, { clientX: 340, clientY: 400, pointerId: 1 });

    expect(screen.getByText("テスト青果店")).toBeInTheDocument(); // a のまま（送られていない）
  });

  it("pointercancel で押下状態と一時停止が解除される", () => {
    const stories = [
      makeStory({ id: "a", vendor: { id: "v1", shop_name: "八百屋A", shop_image_url: null, store_number: 1 } }),
      makeStory({ id: "b", vendor: { id: "v2", shop_name: "八百屋B", shop_image_url: null, store_number: 2 } }),
    ];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    fireEvent.pointerDown(surface, { clientX: 300, clientY: 400, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.pointerCancel(surface, { clientX: 300, clientY: 400, pointerId: 1 });

    // キャンセル後は押下情報がリセットされているので、通常のタップが再び効く
    tap(surface, 300);
    expect(screen.getByText("八百屋B")).toBeInTheDocument(); // b に進んだ
  });

  it("15秒経過すると自動的に次の投稿へ進む", () => {
    const stories = [
      makeStory({ id: "a", vendor: { id: "v1", shop_name: "八百屋A", shop_image_url: null, store_number: 1 } }),
      makeStory({ id: "b", vendor: { id: "v2", shop_name: "八百屋B", shop_image_url: null, store_number: 2 } }),
    ];
    const onClose = vi.fn();
    render(<StoryViewer stories={stories} initialIndex={0} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByText("八百屋B")).toBeInTheDocument();
  });

  it("長押し中（一時停止中）は自動送りタイマーが進まない", () => {
    const stories = [makeStory({ id: "a" }), makeStory({ id: "b" })];
    const onClose = vi.fn();
    const { container } = render(
      <StoryViewer stories={stories} initialIndex={0} onClose={onClose} />
    );
    const surface = getPressSurface(container);

    fireEvent.pointerDown(surface, { clientX: 300, clientY: 400, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(300); // 長押し判定 → 一時停止
    });
    act(() => {
      vi.advanceTimersByTime(20000); // 一時停止中なので自動送りは発火しないはず
    });

    expect(screen.getByText("テスト青果店")).toBeInTheDocument(); // a のまま
  });
});
