import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import WithdrawSection from "./WithdrawSection";

const apiRequest = vi.fn();
const signOut = vi.fn();
const assign = vi.fn();
vi.mock("@/lib/utils/apiRequest", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }));
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: { signOut: (...args: unknown[]) => signOut(...args) } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  apiRequest.mockResolvedValue({ ok: true });
  signOut.mockResolvedValue({ error: null });
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
});

const start = () => fireEvent.click(screen.getByRole("button", { name: "退会の手続きへ進む" }));

describe("WithdrawSection", () => {
  it("消えるもの・残るものを先に説明する。メンバーには、代表者の氏名の項目は出さない", () => {
    render(<WithdrawSection role="member" hasOtherMembers />);

    expect(screen.getByText(/このログインアカウント/)).toBeInTheDocument();
    expect(screen.getByText(/お店の掲載情報/)).toBeInTheDocument();
    expect(screen.queryByText(/代表者として登録した、あなたの氏名/)).not.toBeInTheDocument();
  });

  it("自分だけの代表者には、氏名が消えることと、お店がアカウントなしに戻ることを書く", () => {
    render(<WithdrawSection role="owner" hasOtherMembers={false} />);

    expect(screen.getByText(/代表者として登録した、あなたの氏名/)).toBeInTheDocument();
    expect(screen.getByText(/アカウントなしの状態になります/)).toBeInTheDocument();
  });

  it("ほかにメンバーがいる代表者は、手続きに進めず、引き継ぎを案内する", () => {
    render(<WithdrawSection role="owner" hasOtherMembers />);

    expect(screen.getByText(/ほかにメンバーがいる間は退会できません/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退会の手続きへ進む" })).not.toBeInTheDocument();
  });

  it("「退会する」と入力するまで、退会ボタンは押せない", () => {
    render(<WithdrawSection role="member" hasOtherMembers />);
    start();

    const button = screen.getByRole("button", { name: "退会する" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/下の欄に「退会する」と入力/), { target: { value: "たいかい" } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/下の欄に「退会する」と入力/), { target: { value: "退会する" } });
    expect(button).toBeEnabled();
  });

  it("退会したら、ブラウザのログイン情報を捨ててトップへ移る", async () => {
    render(<WithdrawSection role="member" hasOtherMembers />);
    start();
    fireEvent.change(screen.getByLabelText(/下の欄に「退会する」と入力/), { target: { value: "退会する" } });
    fireEvent.click(screen.getByRole("button", { name: "退会する" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(apiRequest).toHaveBeenCalledWith("/api/vendor/account/delete", { method: "DELETE", body: { confirm: true } }, expect.any(String));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("退会できなかったら、理由を出して移動しない（もう一度押せる）", async () => {
    apiRequest.mockRejectedValue(new Error("退会できませんでした。もう一度お試しください"));
    render(<WithdrawSection role="member" hasOtherMembers />);
    start();
    fireEvent.change(screen.getByLabelText(/下の欄に「退会する」と入力/), { target: { value: "退会する" } });
    fireEvent.click(screen.getByRole("button", { name: "退会する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("退会できませんでした");
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "退会する" })).toBeEnabled();
  });
});
