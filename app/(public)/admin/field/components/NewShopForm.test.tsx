import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewShopForm, normalizeShopName } from "./NewShopForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

const shops = [{ id: "s1", name: "はなや", storeNumber: 12 }];
const calls: { url: string; method: string; body?: unknown }[] = [];

beforeEach(() => {
  calls.length = 0;
  push.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
      if (url.includes("/categories")) return new Response(JSON.stringify({ categories: [{ id: "c1", name: "食べ物" }] }));
      return new Response(JSON.stringify({ ok: true, id: "new-id" }), { status: 201 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("normalizeShopName", () => {
  it("空白・全角半角・大文字小文字の違いは同じ名前とみなす", () => {
    expect(normalizeShopName(" はな　や ")).toBe(normalizeShopName("はなや"));
    expect(normalizeShopName("ＡＢＣ商店")).toBe(normalizeShopName("abc商店"));
  });
});

describe("NewShopForm", () => {
  it("店名を入れて作ると、店舗の編集画面へ進む", async () => {
    render(<NewShopForm shops={shops} onClose={() => {}} />);
    const button = screen.getByRole("button", { name: "この店舗を作る" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("店名"), { target: { value: "新しい八百屋" } });
    fireEvent.click(button);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/field/new-id"));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ shop_name: "新しい八百屋", category_id: null });
  });

  it("同じ名前の店舗があるときは、その店舗を見せ、確かめるまで作れない", async () => {
    render(<NewShopForm shops={shops} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("店名"), { target: { value: "はなや" } });

    expect(screen.getByText("同じ名前の店舗がすでにあります")).toBeTruthy();
    expect(screen.getByRole("link", { name: /はなや（店番 12）/ }).getAttribute("href")).toBe("/admin/field/s1");
    const button = screen.getByRole("button", { name: "この店舗を作る" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("別の店舗なので、新しく作る"));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
  });
});
