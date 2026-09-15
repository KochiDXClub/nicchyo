import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsultFeedback } from "./ConsultFeedback";

const CONSULT_ID = "3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b";

function mockFetch(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 400 });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConsultFeedback", () => {
  it.each([
    ["ID が無い", undefined],
    ["マップからの引き継ぎ", "handoff-0"],
    ["仮の ID（Date.now）", "1757900000000"],
  ])("%s ときは評価を出さない", (_label, consultId) => {
    const { container } = render(<ConsultFeedback consultId={consultId} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("UUID のときは評価を出す", () => {
    render(<ConsultFeedback consultId={CONSULT_ID} />);
    expect(screen.getByRole("button", { name: "役に立った" })).toBeInTheDocument();
  });

  it("保存できたときだけお礼を出す", async () => {
    const fetchMock = mockFetch(true);
    render(<ConsultFeedback consultId={CONSULT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "役に立った" }));

    expect(await screen.findByText("ありがとうございました")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("保存に失敗したらお礼を出さず、もう一度送れるようにする", async () => {
    mockFetch(false);
    render(<ConsultFeedback consultId={CONSULT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "役に立った" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("送れませんでした");
    expect(screen.queryByText("ありがとうございました")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "役に立った" })).toBeEnabled();
  });

  it("通信そのものが失敗しても、お礼を出さない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    render(<ConsultFeedback consultId={CONSULT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "役に立った" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("ありがとうございました")).not.toBeInTheDocument();
  });

  it("失敗しても書いた改善点は残る", async () => {
    mockFetch(false);
    render(<ConsultFeedback consultId={CONSULT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "改善が必要" }));
    const input = screen.getByPlaceholderText("改善点を教えてください（任意）");
    fireEvent.change(input, { target: { value: "店の場所が違った" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await screen.findByRole("alert");
    expect(screen.getByPlaceholderText("改善点を教えてください（任意）")).toHaveValue("店の場所が違った");
  });

  it("日本語入力の変換を確定する Enter では送らない", () => {
    const fetchMock = mockFetch(true);
    render(<ConsultFeedback consultId={CONSULT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "改善が必要" }));
    const input = screen.getByPlaceholderText("改善点を教えてください（任意）");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("変換中でなければ Enter で送る", async () => {
    const fetchMock = mockFetch(true);
    render(<ConsultFeedback consultId={CONSULT_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "改善が必要" }));
    const input = screen.getByPlaceholderText("改善点を教えてください（任意）");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
