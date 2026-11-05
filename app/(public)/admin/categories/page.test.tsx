import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions: { isAdmin: true }, isLoading: false }) }));
vi.mock("@/components/admin", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));

import AdminCategoriesPage from "./page";

type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[];
let translateImpl: () => Response | Promise<Response>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => {
  calls = [];
  translateImpl = () => json({ ok: true, nameEn: "Food" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/admin/categories/translate") return translateImpl();
      if (!init?.method) return json({ categories: [{ id: "c1", name: "野菜", name_en: "Vegetables", created_at: null }, { id: "c2", name: "工芸", name_en: null, created_at: null }] });
      return json({ ok: true }, 201);
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("カテゴリ管理（英語名）", () => {
  it("一覧に英語名を出し、無いものは「英語名なし」と出す", async () => {
    render(<AdminCategoriesPage />);
    expect(await screen.findByText("Vegetables")).toBeTruthy();
    expect(screen.getByText("英語名なし")).toBeTruthy();
  });

  it("日本語名を入れて AI で英訳し、直してから日本語名と英語名を一緒に追加する", async () => {
    render(<AdminCategoriesPage />);
    await screen.findByText("Vegetables");
    fireEvent.change(screen.getByLabelText("日本語名"), { target: { value: "食べ物" } });
    fireEvent.click(screen.getByRole("button", { name: "AIで英訳" }));
    await waitFor(() => expect((screen.getByLabelText(/English name/) as HTMLInputElement).value).toBe("Food"));
    fireEvent.change(screen.getByLabelText(/English name/), { target: { value: "Food & Drink" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url === "/api/admin/categories")).toBeTruthy());
    expect(calls.find((c) => c.method === "POST" && c.url === "/api/admin/categories")?.body).toEqual({ name: "食べ物", nameEn: "Food & Drink" });
  });

  it("編集では日本語名と英語名を同時に直して保存する", async () => {
    render(<AdminCategoriesPage />);
    await screen.findByText("Vegetables");
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    expect((screen.getAllByLabelText(/English name/)[1] as HTMLInputElement).value).toBe("Vegetables");
    fireEvent.change(screen.getAllByLabelText(/English name/)[1], { target: { value: "Veggies" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeTruthy());
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ url: "/api/admin/categories/c1", body: { name: "野菜", nameEn: "Veggies" } });
  });

  it("翻訳中に別のカテゴリを開いたら、翻訳の結果は捨てる", async () => {
    let resolveTranslate: (res: Response) => void = () => {};
    translateImpl = () => new Promise<Response>((resolve) => (resolveTranslate = resolve));
    render(<AdminCategoriesPage />);
    await screen.findByText("Vegetables");
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "AIで英訳" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    resolveTranslate(json({ ok: true, nameEn: "WRONG" }));
    await new Promise((r) => setTimeout(r, 20));
    expect((screen.getAllByLabelText(/English name/)[1] as HTMLInputElement).value).toBe("");
  });

  it("翻訳中に追加を押したら、翻訳の結果は追加フォームに入れない", async () => {
    let resolveTranslate: (res: Response) => void = () => {};
    translateImpl = () => new Promise<Response>((resolve) => (resolveTranslate = resolve));
    render(<AdminCategoriesPage />);
    await screen.findByText("Vegetables");
    fireEvent.change(screen.getByLabelText("日本語名"), { target: { value: "食べ物" } });
    fireEvent.click(screen.getByRole("button", { name: "AIで英訳" }));
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url === "/api/admin/categories")).toBe(true));
    resolveTranslate(json({ ok: true, nameEn: "WRONG" }));
    await new Promise((r) => setTimeout(r, 20));
    expect((screen.getByLabelText(/English name/) as HTMLInputElement).value).toBe("");
  });

  it("編集中に日本語名を書き換えたら、書き換え前の名前の翻訳結果は捨てる", async () => {
    let resolveTranslate: (res: Response) => void = () => {};
    translateImpl = () => new Promise<Response>((resolve) => (resolveTranslate = resolve));
    render(<AdminCategoriesPage />);
    await screen.findByText("Vegetables");
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "AIで英訳" })[1]);
    fireEvent.change(screen.getAllByLabelText("日本語名")[1], { target: { value: "手工芸" } });
    resolveTranslate(json({ ok: true, nameEn: "OLD NAME TRANSLATION" }));
    await new Promise((r) => setTimeout(r, 20));
    expect((screen.getAllByLabelText(/English name/)[1] as HTMLInputElement).value).toBe("");
  });
});
