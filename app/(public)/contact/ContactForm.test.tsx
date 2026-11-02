import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactForm from "./ContactForm";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("category=sponsor") }));
vi.mock("@/lib/contact/prefill", () => ({ takeContactPrefill: () => null }));

const submit = (container: HTMLElement) => fireEvent.submit(container.querySelector("form")!);

describe("ContactForm の入力検証", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true })));
  afterEach(() => vi.unstubAllGlobals());

  it("未入力の送信で日本語のエラーを表示し、APIを呼ばない", async () => {
    const { container } = render(<ContactForm />);
    submit(container);
    expect(await screen.findByText("メールアドレスは必須です")).toBeTruthy();
    expect(screen.getByText("内容は10文字以上で入力してください")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("不正なメールと短い本文を直すと、カテゴリを含めて送信できる", async () => {
    const { container } = render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/メールアドレス/), { target: { value: "invalid" } });
    fireEvent.change(screen.getByLabelText(/お問い合わせ内容/), { target: { value: "短文" } });
    submit(container);
    expect(await screen.findByText(/返信先として使用しますので/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/メールアドレス/), { target: { value: "visitor@example.com" } });
    fireEvent.change(screen.getByLabelText(/お問い合わせ内容/), { target: { value: "協賛について相談したいです。" } });
    submit(container);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/contact");
    expect(JSON.parse(String(init?.body))).toMatchObject({ email: "visitor@example.com", category: "sponsor", message: "協賛について相談したいです。" });
  });
});
