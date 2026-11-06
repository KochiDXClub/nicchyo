import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions: { isAdmin: true }, isLoading: false }) }));
vi.mock("@/components/admin", () => ({ AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>, AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
import Page from "./page";
const vendor = "22222222-2222-4222-8222-222222222222";
const data = { candidates: [{ legacy_shop_id: 12, vendor_ids: [vendor], candidate_count: 1 }], aliases: [], revocations: [], vendors: [{ id: vendor, shop_name: "お店", public_shop_id: 1001 }] };
const settings = { enabled: false, revision: 1, summary: { date: "2026-11-01", scheduled: 1, conflicts: 0, unplanned: 0, closed: false } };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("旧番号の確認画面", () => {
  it("番号と根拠を確認し、承認後だけ対応を保存する", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === "POST" ? { ok: true } : url.includes("public-schedule") ? settings : data), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Page />);
    fireEvent.change(await screen.findByLabelText("旧番号（001〜999）"), { target: { value: "012" } });
    fireEvent.change(screen.getByLabelText("対応する店舗"), { target: { value: vendor } });
    fireEvent.change(screen.getByLabelText("確認した根拠（10文字以上）"), { target: { value: "紙の住所録を確認しました" } });
    fireEvent.click(screen.getByRole("button", { name: "この対応を確定" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "この対応を確定" }));
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  });
  it("今後の予定に競合がある間は公開できない", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("public-schedule") ? { ...settings, summary: { ...settings.summary, conflicts: 1 } } : data), { status: 200 })));
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("競合");
    expect(screen.getByRole("button", { name: "出店予定を公開" })).toBeDisabled();
  });
});
