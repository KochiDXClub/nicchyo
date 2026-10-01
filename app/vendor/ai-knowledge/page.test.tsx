import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import type { AiNote } from "@/lib/vendor/aiNotes";
import AiKnowledgePage from "./page";

const fetchAiNotes = vi.fn();
const createAiNote = vi.fn();
const updateAiNote = vi.fn();
const deleteAiNote = vi.fn();
const saveAiSettings = vi.fn();
const { MockAiNotesError } = vi.hoisted(() => ({ MockAiNotesError: class extends Error {} }));

vi.mock("../_services/aiNotesService", () => ({
  AiNotesError: MockAiNotesError,
  fetchAiNotes: (...args: unknown[]) => fetchAiNotes(...args),
  createAiNote: (...args: unknown[]) => createAiNote(...args),
  updateAiNote: (...args: unknown[]) => updateAiNote(...args),
  deleteAiNote: (...args: unknown[]) => deleteAiNote(...args),
  saveAiSettings: (...args: unknown[]) => saveAiSettings(...args),
}));

// 「もう知っていること」は店舗情報の読み込みが要るので、このテストでは読めなかった扱いにする
vi.mock("../_services/askService", () => ({
  fetchAskSnapshot: () => Promise.reject(new Error("skip")),
}));

const AUTH = { user: { id: "v1", name: "yamada" } };
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => AUTH }));

vi.mock("@/app/(public)/consult/components/GrandmaAvatar", () => ({
  default: () => <div data-testid="grandma" />,
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

const NOTE: AiNote = {
  id: "n1",
  title: "混む時間",
  content: "10時〜11時は10分くらい待つことがあります",
  forVisitors: true,
  forVendor: false,
  searchable: true,
  updatedAt: "2026-10-01T00:00:00Z",
};

async function renderPage() {
  render(<AiKnowledgePage />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe("にちよさんに教える", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAiNotes.mockResolvedValue({
      notes: [NOTE],
      settings: { useStatsInVendorHelp: true, sharePopularWithVisitors: false },
    });
  });

  it("ノートをトピックタイトル・本文・届け先つきのカードで並べる", async () => {
    await renderPage();
    const card = screen.getByRole("button", { name: /混む時間/ });
    expect(within(card).getByText("10時〜11時は10分くらい待つことがあります")).toBeInTheDocument();
    expect(within(card).getByText("お客さんだけ")).toBeInTheDocument();
  });

  it("新しいノートを書いて教えると、一覧に足す", async () => {
    createAiNote.mockResolvedValue({ ...NOTE, id: "n2", title: "お支払い方法", content: "現金だけです", forVendor: true });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "ノートを書く" }));
    const sheet = screen.getByRole("dialog", { name: "ノートを書く" });
    // 候補を押すと、そのままトピックタイトルに入る
    fireEvent.click(within(sheet).getByRole("button", { name: "お支払い方法" }));
    expect(within(sheet).getByLabelText("トピックタイトル")).toHaveValue("お支払い方法");
    fireEvent.change(within(sheet).getByLabelText("本文"), { target: { value: "現金だけです" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "にちよさんに教える" }));
    });

    expect(createAiNote).toHaveBeenCalledWith({
      title: "お支払い方法",
      content: "現金だけです",
      forVisitors: true,
      forVendor: true,
    });
    // 閉じるアニメーションのあとでシートが外れる
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /お支払い方法/ })).toBeInTheDocument();
  });

  it("どのにちよさんにも教えない設定では、教えるボタンを押せず理由を出す", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "ノートを直す" });

    fireEvent.click(within(sheet).getByRole("switch", { name: /お客さんのにちよさん/ }));
    expect(within(sheet).getByText("どちらか1つは選んでください")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "にちよさんに教える" })).toBeDisabled();
  });

  it("消すときはもう一度確かめてから消す", async () => {
    deleteAiNote.mockResolvedValue(undefined);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "ノートを直す" });

    fireEvent.click(within(sheet).getByRole("button", { name: "このノートを消す" }));
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "消す" }));
    });

    expect(deleteAiNote).toHaveBeenCalledWith("n1");
    expect(screen.getByText("まだノートがありません")).toBeInTheDocument();
  });

  it("保存できなかったら理由を出して、書いたものは残す", async () => {
    updateAiNote.mockRejectedValue(new MockAiNotesError("続けて保存しすぎました。"));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "ノートを直す" });
    fireEvent.change(within(sheet).getByLabelText("本文"), { target: { value: "15分くらい待ちます" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "にちよさんに教える" }));
    });

    expect(within(sheet).getByRole("alert")).toHaveTextContent("続けて保存しすぎました。");
    expect(within(sheet).getByLabelText("本文")).toHaveValue("15分くらい待ちます");
  });

  it("お店の数字のスイッチはその場で保存し、保存できなければ元に戻す", async () => {
    saveAiSettings.mockRejectedValueOnce(new MockAiNotesError("うまく保存できんかった。"));
    await renderPage();
    const toggle = screen.getByRole("switch", { name: /よく売れている商品/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(saveAiSettings).toHaveBeenCalledWith({ useStatsInVendorHelp: true, sharePopularWithVisitors: true });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("うまく保存できんかった。");
  });
});
