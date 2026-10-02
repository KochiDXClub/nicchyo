import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/vendor/post/new";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/ui/bodyScrollLock", () => ({ useBodyScrollLock: () => {} }));

import VendorTourHost from "./VendorTourHost";

const fetchMock = vi.fn();

function respondSeen(seen: string[] | null) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? { ok: true, json: async () => ({ ok: true }) }
      : seen
        ? { ok: true, json: async () => ({ seen }) }
        : { ok: false, json: async () => ({}) }
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  pathname = "/vendor/post/new";
});

describe("VendorTourHost", () => {
  it("まだ見ていない画面では自動で開き、最後の「了解した」で閉じて記録する", async () => {
    respondSeen([]);
    render(<VendorTourHost />);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("写真を1枚、撮るか選ぶだけ")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("出しておく期間を選べます")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "了解した" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/vendor/tours");
    expect(JSON.parse(post?.[1].body)).toEqual({ key: "post-new" });
  });

  it("見た画面では自動で開かず、「?」から何度でも開ける", async () => {
    respondSeen(["post-new"]);
    render(<VendorTourHost />);

    const button = await screen.findByRole("button", { name: "「近況を出す」の説明を見る" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("途中で閉じたときは記録しない", async () => {
    respondSeen([]);
    render(<VendorTourHost />);
    await screen.findByRole("dialog");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("記録を読めなかったときは、自動では開かない（「?」は出る）", async () => {
    respondSeen(null);
    render(<VendorTourHost />);

    await screen.findByRole("button", { name: "「近況を出す」の説明を見る" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("説明のない画面では何も出さない", async () => {
    pathname = "/vendor/help";
    respondSeen([]);
    const { container } = render(<VendorTourHost />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});
