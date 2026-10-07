import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FieldShopEditor } from "./FieldShopEditor";

vi.mock("./LocationPicker", () => ({ LocationPicker: () => null }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/image/clientCompression", () => ({
  createStoreImages: async () => ({ mainBlob: new Blob(["m"]), thumbBlob: new Blob(["t"]) }),
  imageErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const baseShop = {
  id: "11111111-1111-4111-8111-111111111111",
  shop_name: "はなや",
  category_id: null,
  category_name: null,
  owner_name: null,
  strength: null,
  style: null,
  main_products: [],
  main_product_prices: {},
  business_hours_start: null,
  business_hours_end: null,
  payment_methods: [],
  rain_policy: null,
  sns_instagram: null,
  sns_x: null,
  sns_hp: null,
  shop_image_url: null,
  listing_status: "allowed",
  photo_use_allowed: true,
  listing_consented_on: "2026-10-04",
  listing_consent_note: null,
  store_number: null,
  updated_at: "2026-10-04T00:00:00.000Z",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("FieldShopEditor", () => {
  const calls: { url: string; method: string; body?: unknown }[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body });
        if (url.endsWith("/image")) return json({ ok: true, url: "https://x.supabase.co/img.webp", updated_at: "2026-10-05T00:00:00.000Z" });
        if (url.endsWith("/location") && method === "PUT") return json({ ok: true });
        if (url.endsWith("/location")) return json({ locations: [], current: { storeNumber: 12, lat: 33.5, lng: 133.5 } });
        if (url.includes("/categories")) return json({ categories: [] });
        if (method === "PATCH") return json({ ok: true });
        return json({ shop: baseShop });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("写真を保存したあとの「内容を保存」は、写真保存で進んだ updated_at を送る（409 にならない）", async () => {
    const { container } = render(<FieldShopEditor shopId={baseShop.id} />);
    const nameInput = (await screen.findByDisplayValue("はなや")) as HTMLInputElement;

    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/image"))).toBe(true));

    fireEvent.change(nameInput, { target: { value: "はなや本店" } });
    fireEvent.click(await screen.findByRole("button", { name: "内容を保存" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect((patch.body as { updated_at: string }).updated_at).toBe("2026-10-05T00:00:00.000Z");
  });

  it("位置の保存に成功しても、未保存のフォーム入力は消えない", async () => {
    render(<FieldShopEditor shopId={baseShop.id} />);
    const nameInput = (await screen.findByDisplayValue("はなや")) as HTMLInputElement;
    await waitFor(() => expect(screen.getByDisplayValue("12")).toBeTruthy());

    fireEvent.change(nameInput, { target: { value: "はなや本店" } });
    fireEvent.click(screen.getByRole("button", { name: "この位置で保存" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    await waitFor(() => expect(screen.getByText(/保存済み: 店番 12/)).toBeTruthy());

    expect((screen.getByDisplayValue("はなや本店") as HTMLInputElement).value).toBe("はなや本店");
    expect(screen.getByRole("button", { name: "内容を保存" })).toBeTruthy();
  });
});
