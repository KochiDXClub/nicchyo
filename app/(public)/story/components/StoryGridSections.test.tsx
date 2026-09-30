import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import StoryGridSections, { STORY_CARD_LAYOUT_MAX } from "./StoryGridSections";
import type { StoryItem } from "../types";

const DAY_MS = 86_400_000;

function makeStory(id: string, daysAgo: number, body: string | null = null): StoryItem {
  return {
    id,
    body,
    image_url: "https://example.supabase.co/storage/v1/object/public/stories/x.jpg",
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    vendor: { id: `v-${id}`, shop_name: `店${id}`, shop_image_url: null, store_number: 1 },
  };
}

describe("StoryGridSections", () => {
  it("件数が少ないときは、本文の冒頭が読めるカードで並べる", () => {
    render(
      <StoryGridSections stories={[makeStory("a", 0, "朝どれの人参です")]} heartCounts={{}} onOpen={vi.fn()} />
    );

    expect(screen.getByText("朝どれの人参です")).toBeInTheDocument();
  });

  it("件数が多いときは、写真のタイルで並べる（本文は出さない）", () => {
    const stories = Array.from({ length: STORY_CARD_LAYOUT_MAX + 1 }, (_, i) =>
      makeStory(String(i), 0, `本文${i}`)
    );
    render(<StoryGridSections stories={stories} heartCounts={{}} onOpen={vi.fn()} />);

    expect(screen.queryByText("本文0")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /の投稿を見る$/ })).toHaveLength(stories.length);
  });

  it("たたんだ「それより前」は数えず、見えている件数が少なければカードで並べる", () => {
    const older = Array.from({ length: STORY_CARD_LAYOUT_MAX + 4 }, (_, i) => makeStory(`o${i}`, 30));
    render(
      <StoryGridSections
        stories={[makeStory("new1", 0, "今週の本文"), makeStory("new2", 1), ...older]}
        heartCounts={{}}
        onOpen={vi.fn()}
      />
    );

    expect(screen.getByText("今週の本文")).toBeInTheDocument();
  });

  it("今週・先週の投稿があれば「それより前」はたたんでおき、押すと開く", () => {
    render(
      <StoryGridSections
        stories={[makeStory("new", 0), makeStory("old", 30)]}
        heartCounts={{}}
        onOpen={vi.fn()}
      />
    );

    const toggle = screen.getByRole("button", { name: /それより前/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "店oldの投稿を見る" })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "店oldの投稿を見る" })).toBeInTheDocument();
  });

  it("古い投稿しかないときは「それより前」を開いておく", () => {
    render(<StoryGridSections stories={[makeStory("old", 30)]} heartCounts={{}} onOpen={vi.fn()} />);

    expect(screen.getByRole("button", { name: /それより前/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "店oldの投稿を見る" })).toBeInTheDocument();
  });

  it("押した投稿の、全体の並びでの位置でビューアを開く", () => {
    const onOpen = vi.fn();
    render(
      <StoryGridSections
        stories={[makeStory("a", 0), makeStory("b", 8)]}
        heartCounts={{}}
        onOpen={onOpen}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "店bの投稿を見る" }));

    expect(onOpen).toHaveBeenCalledWith(1);
  });
});
