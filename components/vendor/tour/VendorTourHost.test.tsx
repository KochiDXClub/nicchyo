import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/vendor/post/new";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/ui/bodyScrollLock", () => ({ useBodyScrollLock: () => {} }));

import { requestOpenVendorTour } from "@/lib/vendor/tourEvents";
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

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

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
    expect(screen.getByText("写真を1枚。ひとことは無くてもOK")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("出しておく期間を選べます")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "了解した" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts()[0][0]).toBe("/api/vendor/tours");
    expect(JSON.parse(posts()[0][1].body)).toEqual({ keys: ["post-new"] });
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
    expect(posts()).toHaveLength(0);
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

describe("VendorTourHost（複数の機能がある画面）", () => {
  beforeEach(() => {
    pathname = "/my-shop";
  });

  it("まだ見ていない機能の説明だけを自動で出し、見た分は出さない", async () => {
    respondSeen(["home-chat", "home-actions"]);
    render(<VendorTourHost />);

    expect(await screen.findByText("お休みする日曜日は、押すだけで登録")).toBeTruthy();
    expect(screen.queryByText("言葉にするだけで、お店の情報が直せます")).toBeNull();
    expect(screen.getByText("出店者トップ ／ お休みカレンダー")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "了解した" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1].body)).toEqual({ keys: ["home-calendar"] });
  });

  it("「?」では、その画面の機能の説明を順にすべて見せる", async () => {
    respondSeen(["home-chat", "home-actions", "home-calendar"]);
    render(<VendorTourHost />);

    fireEvent.click(await screen.findByRole("button", { name: "「出店者トップ」の説明を見る" }));

    expect(await screen.findByText("言葉にするだけで、お店の情報が直せます")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("いちばん使うのは、この2つ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("お休みする日曜日は、押すだけで登録")).toBeTruthy();
  });

  it("画面の中の機能の「?」から、その機能だけを開く", async () => {
    respondSeen(["home-chat", "home-actions", "home-calendar"]);
    render(<VendorTourHost />);
    await screen.findByRole("button", { name: "「出店者トップ」の説明を見る" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => requestOpenVendorTour("home-calendar"));

    expect(await screen.findByText("お休みする日曜日は、押すだけで登録")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "次へ" })).toBeNull();
  });
});
