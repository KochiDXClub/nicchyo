import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import StoryGridSections from "./StoryGridSections";
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
  it("投稿が1件でも写真を主役に表示し、押すとビューアを開く", () => {
    const onOpen = vi.fn();
    render(<StoryGridSections stories={[makeStory("a", 0, "朝どれの人参です")]} heartCounts={{ a: 3 }} onOpen={onOpen} />);

    expect(screen.getByText("朝どれの人参です")).toBeInTheDocument();
    expect(screen.getByText("店a")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "店aの投稿を見る" }));
    expect(onOpen).toHaveBeenCalledWith(0);
  });

  it("投稿が多くても写真を主役に表示する", () => {
    const stories = Array.from({ length: 7 }, (_, i) => makeStory(String(i), 0, `本文${i}`));
    render(<StoryGridSections stories={stories} heartCounts={{}} onOpen={vi.fn()} />);

    expect(screen.getByText("本文0")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /の投稿を見る$/ })).toHaveLength(stories.length);
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
