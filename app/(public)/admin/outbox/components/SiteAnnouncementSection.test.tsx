import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));

import { SiteAnnouncementSection } from "./SiteAnnouncementSection";

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];

function stubFetch(translate: () => Response = () => json({ ok: true, titleEn: "Cancelled due to rain", bodyEn: "The market is cancelled." })) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/admin/announcements/translate") return translate();
      if (url === "/api/admin/announcements" && !init?.method) return json({ announcements: [] });
      return json({ ok: true }, 201);
    })
  );
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const posted = () => calls.find((c) => c.method === "POST" && c.url === "/api/admin/announcements");

async function fillJapanese() {
  fireEvent.change(await screen.findByLabelText("タイトル"), { target: { value: "雨天中止" } });
  fireEvent.change(screen.getByLabelText("本文"), { target: { value: "雨天のため中止です" } });
}

beforeEach(() => {
  stubFetch();
  vi.stubGlobal("confirm", vi.fn(() => true));
  window.scrollTo = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("SiteAnnouncementSection（英語版）", () => {
  it("日本語が空のうちは翻訳できない", async () => {
    render(<SiteAnnouncementSection />);
    expect(((await screen.findByRole("button", { name: "AIで英語に翻訳する" })) as HTMLButtonElement).disabled).toBe(true);
  });

  it("日本語 → 翻訳 → 英語を直す → 日本語と英語を一緒に投稿する", async () => {
    render(<SiteAnnouncementSection />);
    await fillJapanese();
    fireEvent.click(screen.getByRole("button", { name: "AIで英語に翻訳する" }));

    const titleEn = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(titleEn.value).toBe("Cancelled due to rain");
    expect(screen.getByText("AI翻訳のまま")).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/translate"))?.body).toEqual({ title: "雨天中止", body: "雨天のため中止です" });

    fireEvent.change(titleEn, { target: { value: "Cancelled (rain)" } });
    expect(screen.getByText("手直し済み")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "日本語と英語で投稿する" }));
    await waitFor(() => expect(posted()).toBeTruthy());
    expect(posted()?.body).toMatchObject({
      title: "雨天中止",
      titleEn: "Cancelled (rain)",
      bodyEn: "The market is cancelled.",
      translationStatus: "reviewed",
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("英語版なしで公開するときは確認し、断ったら投稿しない", async () => {
    render(<SiteAnnouncementSection />);
    await fillJapanese();
    vi.stubGlobal("confirm", vi.fn(() => false));
    fireEvent.click(screen.getByRole("button", { name: "日本語のみで投稿する" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(posted()).toBeUndefined();
  });

  it("翻訳したあとに日本語を直すと警告し、投稿前に確認する", async () => {
    render(<SiteAnnouncementSection />);
    await fillJapanese();
    fireEvent.click(screen.getByRole("button", { name: "AIで英語に翻訳する" }));
    await screen.findByLabelText("Title");
    fireEvent.change(screen.getByLabelText("本文"), { target: { value: "雨天のため中止です。ご注意ください" } });
    expect(screen.getByRole("alert").textContent).toContain("英語版は変更前");

    vi.stubGlobal("confirm", vi.fn(() => false));
    fireEvent.click(screen.getByRole("button", { name: "日本語と英語で投稿する" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(posted()).toBeUndefined();
  });

  it("翻訳に失敗しても日本語は残り、英語版なしのまま", async () => {
    stubFetch(() => json({ error: "翻訳できませんでした" }, 502));
    render(<SiteAnnouncementSection />);
    await fillJapanese();
    fireEvent.click(screen.getByRole("button", { name: "AIで英語に翻訳する" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/translate"))).toBe(true));
    expect(await screen.findByRole("button", { name: "AIで英語に翻訳する" })).toBeTruthy();
    expect((screen.getByLabelText("タイトル") as HTMLInputElement).value).toBe("雨天中止");
  });

  it("英語版を使わないを押すと、英語欄を消して日本語のみに戻る", async () => {
    render(<SiteAnnouncementSection />);
    await fillJapanese();
    fireEvent.click(screen.getByRole("button", { name: "AIで英語に翻訳する" }));
    await screen.findByLabelText("Title");
    fireEvent.click(screen.getByRole("button", { name: "英語版を使わない" }));
    expect(await screen.findByRole("button", { name: "日本語のみで投稿する" })).toBeTruthy();
  });
});
