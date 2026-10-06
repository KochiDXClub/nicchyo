import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/vendor/posts";
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

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  window.sessionStorage.clear();
  pathname = "/vendor/posts";
});

describe("VendorTourHost", () => {
  it("まだ見ていない画面では自動で開き、最後の「了解した」で閉じて記録する", async () => {
    respondSeen([]);
    render(<VendorTourHost />);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("写真を1枚。ひとことは無くてもOK")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("出しておく期間を選べます")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("前の投稿を、もう一度出せます")).toBeTruthy();
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

  it("「見た」の一覧が届く前に「?」で開いた説明を、届いたあとに閉じたり置き換えたりしない", async () => {
    let resolveSeen: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
          : new Promise((resolve) => {
              resolveSeen = resolve;
            })
    );
    pathname = "/my-shop";
    render(<VendorTourHost />);

    fireEvent.click(await screen.findByRole("button", { name: "「出店者トップ」の説明を見る" }));
    expect(await screen.findByText("言葉にするだけで、お店の情報が直せます")).toBeTruthy();

    // ここで「見た」の一覧が届く（出店者トップの機能は、まだ1つも見ていない）
    resolveSeen({ ok: true, json: async () => ({ seen: ["home-chat"] }) });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});

    // 開いたまま。見ていない機能だけの説明に置き換わらない（最初のスライドは「見た」機能のもの）
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("言葉にするだけで、お店の情報が直せます")).toBeTruthy();
  });

  it("途中で閉じた説明は、他の画面へ行って戻っても、同じセッションでは自動で出し直さない", async () => {
    respondSeen([]);
    const { rerender } = render(<VendorTourHost />);
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    pathname = "/vendor/help";
    rerender(<VendorTourHost />);
    pathname = "/vendor/posts";
    rerender(<VendorTourHost />);
    await act(async () => {});

    expect(screen.queryByRole("dialog")).toBeNull();
    // 「?」からは、これまでどおり開ける
    fireEvent.click(screen.getByRole("button", { name: "「近況を出す」の説明を見る" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("画面が変わったら、開いていた説明は閉じる（遷移先がまだ見ていない画面なら、そちらの説明が自動で出る）", async () => {
    respondSeen(["post-new", "posts", "analytics"]);
    const { rerender } = render(<VendorTourHost />);
    fireEvent.click(await screen.findByRole("button", { name: "「近況を出す」の説明を見る" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();

    pathname = "/vendor/analytics";
    rerender(<VendorTourHost />);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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

    expect(await screen.findByText("休みにする日曜日は、押すだけで登録")).toBeTruthy();
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
    expect(screen.getByText("休みにする日曜日は、押すだけで登録")).toBeTruthy();
  });
});
