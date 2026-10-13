import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FieldShopEditor } from "./FieldShopEditor";

vi.mock("./LocationPicker", () => ({ LocationPicker: () => null }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/image/clientCompression", () => ({
  createStoreImages: async () => ({ mainBlob: new Blob(["m"]), thumbBlob: new Blob(["t"]) }),
  resizeImageToBlob: async () => new Blob(["p"]),
  STORE_IMAGE_CONFIG: { main: {} },
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
  main_products: [] as string[],
  main_product_prices: {} as Record<string, number | null>,
  product_images: {} as Record<string, string>,
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
  store_number: null as number | null,
  chome: null as number | null,
  updated_at: "2026-10-04T00:00:00.000Z",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("FieldShopEditor", () => {
  let currentShop: typeof baseShop = baseShop;
  const calls: { url: string; method: string; body?: unknown }[] = [];

  beforeEach(() => {
    calls.length = 0;
    currentShop = baseShop;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body });
        if (url.endsWith("/product-image")) {
          return json(method === "DELETE" ? { ok: true } : { ok: true, name: "トマト", url: "https://x.supabase.co/tomato.webp" });
        }
        if (url.endsWith("/image")) return json({ ok: true, url: "https://x.supabase.co/img.webp", updated_at: "2026-10-05T00:00:00.000Z" });
        if (url.endsWith("/location") && method === "PUT") return json({ ok: true });
        if (url.endsWith("/location")) return json({ locations: [], current: { storeNumber: 12, lat: 33.5, lng: 133.5 } });
        if (url.includes("/categories")) return json({ categories: [] });
        if (method === "PATCH") return json({ ok: true });
        return json({ shop: currentShop });
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

  it("写真は「撮る」（カメラ）と「選ぶ」（端末の写真）の別の入口にする", async () => {
    const { container } = render(<FieldShopEditor shopId={baseShop.id} />);
    await screen.findByDisplayValue("はなや");
    expect(screen.getByText("写真を撮る")).toBeTruthy();
    expect(screen.getByText("写真を選ぶ")).toBeTruthy();
    const inputs = [...container.querySelectorAll('input[type="file"]')];
    expect(inputs.map((i) => i.getAttribute("capture"))).toEqual(["environment", null]);
  });

  it("保存済みの商品には写真を登録できる。商品名と写真をサーバーに送る", async () => {
    currentShop = { ...baseShop, main_products: ["トマト"], main_product_prices: { トマト: 300 } };
    render(<FieldShopEditor shopId={baseShop.id} />);
    const input = (await screen.findByLabelText("トマトの写真を選ぶ")) as HTMLInputElement;
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { files: [new File(["x"], "t.jpg", { type: "image/jpeg" })] } });

    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/product-image"))).toBe(true));
    const post = calls.find((c) => c.url.endsWith("/product-image"))!;
    expect(post.method).toBe("POST");
    expect((post.body as FormData).get("name")).toBe("トマト");
    expect(await screen.findByLabelText("トマトの写真を変える")).toBeTruthy();
  });

  it("まだ保存していない商品や、写真の許可がない店舗では、写真を登録できない", async () => {
    currentShop = { ...baseShop, main_products: ["トマト"], main_product_prices: {} };
    const { unmount } = render(<FieldShopEditor shopId={baseShop.id} />);
    await screen.findByLabelText("トマトの写真を選ぶ");
    fireEvent.click(screen.getByRole("button", { name: "＋ 商品を追加" }));
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"][aria-label$="の写真を選ぶ"]')];
    expect(inputs.map((i) => i.disabled)).toEqual([false, true]);
    unmount();

    currentShop = { ...baseShop, main_products: ["トマト"], photo_use_allowed: false };
    render(<FieldShopEditor shopId={baseShop.id} />);
    expect(((await screen.findByLabelText("トマトの写真を選ぶ")) as HTMLInputElement).disabled).toBe(true);
  });

  it("商品の写真を外すと、DELETE で商品名を送る", async () => {
    currentShop = { ...baseShop, main_products: ["トマト"], product_images: { トマト: "https://x.supabase.co/tomato.webp" } };
    render(<FieldShopEditor shopId={baseShop.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "トマトの写真を外す" }));

    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    expect(calls.find((c) => c.method === "DELETE")!.body).toEqual({ name: "トマト" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "トマトの写真を外す" })).toBeNull());
  });

  it("丁目は、位置が未記録でも選べる", async () => {
    render(<FieldShopEditor shopId={baseShop.id} />);
    await screen.findByDisplayValue("はなや");
    expect((screen.getByLabelText("日曜市の丁目") as HTMLSelectElement).disabled).toBe(false);
  });

  it("丁目は、変えたときだけ保存に送る（開いただけの保存では送らない）", async () => {
    currentShop = { ...baseShop, store_number: 12, chome: 3 };
    render(<FieldShopEditor shopId={baseShop.id} />);
    const nameInput = (await screen.findByDisplayValue("はなや")) as HTMLInputElement;
    const select = screen.getByLabelText("日曜市の丁目") as HTMLSelectElement;
    expect(select.value).toBe("3");

    fireEvent.change(nameInput, { target: { value: "はなや本店" } });
    fireEvent.click(await screen.findByRole("button", { name: "内容を保存" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PATCH")!.body).not.toHaveProperty("chome");

    fireEvent.change(screen.getByLabelText("日曜市の丁目"), { target: { value: "5" } });
    fireEvent.click(await screen.findByRole("button", { name: "内容を保存" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "PATCH")[1].body).toMatchObject({ chome: 5 });
  });

  it("「いまの場所を記録する」で、現在地をそのまま記録する（地図に指さなくてよい）", async () => {
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: 33.5614, longitude: 133.538, accuracy: 8.4 } }));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    render(<FieldShopEditor shopId={baseShop.id} />);
    await screen.findByDisplayValue("はなや");

    fireEvent.click(screen.getByRole("button", { name: "いまの場所を記録する" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body).toMatchObject({ lat: 33.5614, lng: 133.538, source: "gps", accuracyM: 8 });
    await waitFor(() => expect(screen.getByText(/現在地（誤差 約8m）/)).toBeTruthy());
    // 地図は開かなくてよい
    expect(screen.queryByRole("button", { name: "この位置を記録" })).toBeNull();
  });

  it("現在地の誤差が大きいときは、確かめて、断ったら記録しない", async () => {
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: 33.5614, longitude: 133.538, accuracy: 80 } }));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<FieldShopEditor shopId={baseShop.id} />);
    await screen.findByDisplayValue("はなや");

    fireEvent.click(screen.getByRole("button", { name: "いまの場所を記録する" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    confirm.mockRestore();
  });

  it("位置の保存に成功しても、未保存のフォーム入力は消えない", async () => {
    render(<FieldShopEditor shopId={baseShop.id} />);
    const nameInput = (await screen.findByDisplayValue("はなや")) as HTMLInputElement;
    await waitFor(() => expect(screen.getByDisplayValue("12")).toBeTruthy());

    fireEvent.change(nameInput, { target: { value: "はなや本店" } });
    fireEvent.click(screen.getByRole("button", { name: "地図で位置を直す（任意）" }));
    fireEvent.click(screen.getByRole("button", { name: "この位置を記録" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    await waitFor(() => expect(screen.getByText(/記録済み: 店番 12/)).toBeTruthy());

    expect((screen.getByDisplayValue("はなや本店") as HTMLInputElement).value).toBe("はなや本店");
    expect(screen.getByRole("button", { name: "内容を保存" })).toBeTruthy();
  });
});
