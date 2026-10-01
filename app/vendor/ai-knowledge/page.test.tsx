import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import type { AiNote } from "@/lib/vendor/aiNotes";
import AiKnowledgePage from "./page";

const fetchAiNotes = vi.fn();
const createAiNote = vi.fn();
const updateAiNote = vi.fn();
const deleteAiNote = vi.fn();
const { MockAiNotesError } = vi.hoisted(() => ({ MockAiNotesError: class extends Error {} }));

vi.mock("../_services/aiNotesService", () => ({
  AiNotesError: MockAiNotesError,
  fetchAiNotes: (...args: unknown[]) => fetchAiNotes(...args),
  createAiNote: (...args: unknown[]) => createAiNote(...args),
  updateAiNote: (...args: unknown[]) => updateAiNote(...args),
  deleteAiNote: (...args: unknown[]) => deleteAiNote(...args),
}));

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

describe("にちよさんが覚えちゅうこと", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAiNotes.mockResolvedValue({ notes: [NOTE], settings: {} });
  });

  it("覚えちゅうことを、トピックタイトル・中身・使う場所つきで並べる", async () => {
    await renderPage();
    const card = screen.getByRole("button", { name: /混む時間/ });
    expect(within(card).getByText("10時〜11時は10分くらい待つことがあります")).toBeInTheDocument();
    expect(within(card).getByText("お客さんへの案内だけ")).toBeInTheDocument();
  });

  it("まだ何も覚えていなければ、相談すれば覚えていくと伝えて、出店者トップへつなぐ", async () => {
    fetchAiNotes.mockResolvedValue({ notes: [], settings: {} });
    await renderPage();

    expect(screen.getByText("まだ覚えちゅうことはないで")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "にちよさんと話す" })).toHaveAttribute("href", "/my-shop");
  });

  it("開いて直すと、その場で保存して一覧も変わる", async () => {
    updateAiNote.mockResolvedValue({ ...NOTE, content: "10時台がいちばん混む" });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "覚えちゅうことを直す" });
    fireEvent.change(within(sheet).getByLabelText("覚えること"), { target: { value: "10時台がいちばん混む" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "これで覚えちょいて" }));
    });

    expect(updateAiNote).toHaveBeenCalledWith("n1", {
      title: "混む時間",
      content: "10時台がいちばん混む",
      forVisitors: true,
      forVendor: false,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("10時台がいちばん混む")).toBeInTheDocument();
  });

  it("どこにも使わない設定では保存できず、理由を出す", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "覚えちゅうことを直す" });

    fireEvent.click(within(sheet).getByRole("switch", { name: /お客さんへの案内/ }));
    expect(within(sheet).getByText("どちらか1つは選んでください")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "これで覚えちょいて" })).toBeDisabled();
  });

  it("忘れさせるときは、もう一度確かめてから消す", async () => {
    deleteAiNote.mockResolvedValue(undefined);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "覚えちゅうことを直す" });

    fireEvent.click(within(sheet).getByRole("button", { name: "にちよさんに忘れさせる" }));
    expect(deleteAiNote).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "忘れさせる" }));
    });

    expect(deleteAiNote).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(screen.queryByRole("button", { name: /混む時間/ })).not.toBeInTheDocument());
  });

  it("自分で書いて覚えさせることもできる", async () => {
    createAiNote.mockResolvedValue({ ...NOTE, id: "n2", title: "試食", content: "たいてい試食できます", forVendor: true });
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "自分で書いて覚えさせる" }));
    const sheet = screen.getByRole("dialog", { name: "自分で書いて覚えさせる" });
    fireEvent.click(within(sheet).getByRole("button", { name: "試食" }));
    fireEvent.change(within(sheet).getByLabelText("覚えること"), { target: { value: "たいてい試食できます" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "これで覚えちょいて" }));
    });

    expect(createAiNote).toHaveBeenCalledWith({
      title: "試食",
      content: "たいてい試食できます",
      forVisitors: true,
      forVendor: true,
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /試食/ })).toBeInTheDocument());
  });

  it("旧「AIに教える」の長いメモ（1000字超）は、短くするまで保存させず、理由を出す", async () => {
    fetchAiNotes.mockResolvedValue({
      notes: [{ ...NOTE, id: "legacy", title: "お店のメモ", content: "あ".repeat(1200) }],
      settings: {},
    });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /お店のメモ/ }));
    const sheet = screen.getByRole("dialog", { name: "覚えちゅうことを直す" });

    expect(within(sheet).getByText(/1000字までにしてや/)).toBeInTheDocument();
    const saveButton = within(sheet).getByRole("button", { name: "これで覚えちょいて" });
    expect(saveButton).toBeDisabled();
    // 押せない理由をボタンに結び付けて、読み上げでも分かるようにする
    expect(saveButton).toHaveAccessibleDescription(/1000字までにしてや/);

    // 長いときは字数の表示もラベルの中に並ぶ
    fireEvent.change(within(sheet).getByLabelText(/^覚えること/), { target: { value: "あ".repeat(900) } });
    expect(within(sheet).getByRole("button", { name: "これで覚えちょいて" })).toBeEnabled();
  });

  it("読み込みに失敗したら、「もういっぺん」で一覧だけを読み直す", async () => {
    fetchAiNotes.mockRejectedValueOnce(new Error("network"));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "もういっぺん" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /混む時間/ })).toBeInTheDocument());
    expect(fetchAiNotes).toHaveBeenCalledTimes(2);
  });

  it("保存できなかったら、シートを開いたまま理由を出す", async () => {
    updateAiNote.mockRejectedValue(new MockAiNotesError("続けて保存しすぎました。"));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /混む時間/ }));
    const sheet = screen.getByRole("dialog", { name: "覚えちゅうことを直す" });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "これで覚えちょいて" }));
    });

    expect(within(sheet).getByRole("alert")).toHaveTextContent("続けて保存しすぎました。");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
