import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import VendorAskStage from "../ask/VendorAskStage";
import { CONTACT_HREF, trimHistory } from "./useVendorHelpChat";
import { takeContactPrefill } from "@/lib/contact/prefill";

vi.mock("@/app/vendor/_services/askService", () => ({
  AskUserFacingError: class extends Error {},
  // 受信箱の中身はこのテストでは見ないので、読み込み中のままにしておく
  fetchAskSnapshot: () => new Promise(() => {}),
  saveAskAnswer: vi.fn(),
}));

vi.mock("@/app/(public)/consult/components/GrandmaAvatar", () => ({
  default: () => <div data-testid="grandma" />,
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function askFromInput(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "にちよさんに相談する" }), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "聞く" }));
  });
}

describe("出店者トップのにちよさんへの相談", () => {
  it("入力欄から聞くと、答えがにちよさんの吹き出しに流れ、運営への問い合わせ先が出る", async () => {
    fetchMock.mockResolvedValue(new Response(streamOf("写真は", "「お店の情報」から変えられるよ。")));
    render(<VendorAskStage vendorId="v1" />);

    expect(screen.getByText("今日もおつかれさま！")).toBeInTheDocument();

    await askFromInput("写真を変えたい");

    await waitFor(() => {
      expect(screen.getByText("写真は「お店の情報」から変えられるよ。")).toBeInTheDocument();
    });
    expect(screen.getByText("「写真を変えたい」")).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/vendor/help-chat");
    expect(JSON.parse(init.body)).toEqual({ text: "写真を変えたい", history: [] });

    const contact = screen.getByRole("link", { name: /運営に問い合わせる/ });
    // 相談の内容は URL に載せない（解析や履歴に残るため）。押したときに sessionStorage で渡す
    expect(contact.getAttribute("href")).toBe(CONTACT_HREF);
    fireEvent.click(contact);
    expect(takeContactPrefill()).toContain("写真を変えたい");

    // 閉じると、いつものひとことに戻り、続けて聞けるよう入力欄にフォーカスが戻る
    fireEvent.click(screen.getByRole("button", { name: "相談を閉じる" }));
    expect(screen.getByText("今日もおつかれさま！")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "にちよさんに相談する" })).toHaveFocus();
  });

  it("続けて聞くと、前のやりとりをいっしょに送る", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(streamOf("ひとつめの答え")))
      .mockResolvedValueOnce(new Response(streamOf("ふたつめの答え")));
    render(<VendorAskStage vendorId="v1" />);

    await askFromInput("ひとつめ");
    await waitFor(() => expect(screen.getByText("ひとつめの答え")).toBeInTheDocument());
    await askFromInput("ふたつめ");
    await waitFor(() => expect(screen.getByText("ふたつめの答え")).toBeInTheDocument());

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      text: "ふたつめ",
      history: [
        { role: "user", text: "ひとつめ" },
        { role: "assistant", text: "ひとつめの答え" },
      ],
    });
  });

  it("失敗したら謝って、運営への問い合わせ先を出す", async () => {
    fetchMock.mockResolvedValue(new Response("err", { status: 502 }));
    render(<VendorAskStage vendorId="v1" />);

    await askFromInput("わからん");

    await waitFor(() => expect(screen.getByText(/うまく答えられんかった/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /運営に問い合わせる/ })).toBeInTheDocument();
  });
  it("ログインが切れたとき（401・403）は、ログインし直すよう案内する", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    render(<VendorAskStage vendorId="v1" />);
    await askFromInput("写真を変えたい");
    await waitFor(() => expect(screen.getByText(/ログインが切れたみたい/)).toBeInTheDocument());
  });

  it("聞きすぎ（429）のときは、少し休むよう案内する", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    render(<VendorAskStage vendorId="v1" />);
    await askFromInput("写真を変えたい");
    await waitFor(() => expect(screen.getByText(/続けて聞きすぎた/)).toBeInTheDocument());
  });

  it("答えの途中で切れたら、切れたことを書き足し、続きの話には使わない", async () => {
    const encoder = new TextEncoder();
    // 1回目の読み取りで途中まで返し、2回目の読み取りで回線が切れる
    let pulls = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(encoder.encode("写真は店舗情報ページで"));
        else controller.error(new Error("network"));
      },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(broken))
      .mockResolvedValueOnce(new Response(streamOf("答え")));
    render(<VendorAskStage vendorId="v1" />);

    await askFromInput("写真を変えたい");
    await waitFor(() => expect(screen.getByText(/途中で切れてしもうた/)).toBeInTheDocument());
    expect(screen.getByText(/写真は店舗情報ページで/)).toBeInTheDocument();

    await askFromInput("もう一回");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).history).toEqual([]);
  });

  it("答えを待つあいだも入力欄からフォーカスを外さない", async () => {
    let finish: (() => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = () => resolve(new Response(streamOf("答え")));
      })
    );
    render(<VendorAskStage vendorId="v1" />);
    const input = screen.getByRole("textbox", { name: "にちよさんに相談する" });
    input.focus();
    await askFromInput("写真を変えたい");

    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(input).toHaveFocus();
    await act(async () => finish?.());
    await waitFor(() => expect(screen.getByText("答え")).toBeInTheDocument());
  });
});

describe("trimHistory", () => {
  it("サーバーの上限（合計6000文字）に収まるよう、新しい方から残す", () => {
    const turns = [
      { role: "user" as const, text: "a".repeat(3000) },
      { role: "assistant" as const, text: "b".repeat(2000) },
      { role: "user" as const, text: "c".repeat(2000) },
      { role: "assistant" as const, text: "d".repeat(2000) },
    ];
    const trimmed = trimHistory(turns);
    expect(trimmed.map((turn) => turn.text[0])).toEqual(["b", "c", "d"]);
  });

  it("1件が長すぎるときは2000文字で切る", () => {
    const [turn] = trimHistory([{ role: "assistant", text: "x".repeat(2500) }]);
    expect(turn.text).toHaveLength(2000);
  });
});
