import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

import AnnouncementBanner from "./AnnouncementBanner";

const item = (id: string, title: string, important = false) => ({ id, title, body: "本文", important, startsAt: "2026-10-10T00:00:00Z", endsAt: null });

function stubAnnouncements(list: unknown[], ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => ({ announcements: list }) }) as Response));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("AnnouncementBanner", () => {
  it("公開中のお知らせが無ければ何も出さない", async () => {
    stubAnnouncements([]);
    const { container } = render(<AnnouncementBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/announcements"));
    expect(container.firstChild).toBeNull();
  });

  it("読み込めなかったときも何も出さない", async () => {
    stubAnnouncements([item("a", "x")], false);
    const { container } = render(<AnnouncementBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("いちばん上の1件を /news へのリンクで出し、ほかにあれば件数を添える", async () => {
    stubAnnouncements([item("a", "雨天中止のお知らせ", true), item("b", "別のお知らせ")]);
    render(<AnnouncementBanner />);
    const link = await screen.findByRole("link", { name: /雨天中止のお知らせ/ });
    expect(link.getAttribute("href")).toBe("/news");
    expect(link.textContent).toContain("ほか1件");
    expect(screen.queryByText("別のお知らせ")).toBeNull();
  });

  it("閉じると次のお知らせが出て、閉じたものは次回も出さない", async () => {
    stubAnnouncements([item("a", "ひとつめ"), item("b", "ふたつめ")]);
    const { unmount } = render(<AnnouncementBanner />);
    await screen.findByText("ひとつめ");
    fireEvent.click(screen.getByRole("button", { name: "このお知らせを閉じる" }));
    expect(await screen.findByText("ふたつめ")).toBeTruthy();
    expect(screen.queryByText("ひとつめ")).toBeNull();

    unmount();
    render(<AnnouncementBanner />);
    expect(await screen.findByText("ふたつめ")).toBeTruthy();
    expect(screen.queryByText("ひとつめ")).toBeNull();
  });
});
