import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth, lookup, sign, from } = vi.hoisted(() => ({ auth: vi.fn(), lookup: vi.fn(), sign: vi.fn(), from: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/vendor/shopContext.server", () => ({ requireVendorContext: auth }));
vi.mock("@/utils/supabase/server", () => ({ createClientWithExtensions: () => ({ from }) }));
vi.mock("@/lib/vendorInquiries/imageStorage.server", () => ({ withSignedInquiryImage: sign }));
import { GET } from "./route";
const vendorId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const request = () => new Request(`https://nicchyo.test/api/vendor/inquiries/${id}`, { headers: { origin: "https://nicchyo.test" } });
const params = () => ({ params: Promise.resolve({ id }) });
describe("スレッドの認可後だけ画像を署名する", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ ok: true, vendorId });
    const query = { select: () => query, eq: () => query, maybeSingle: lookup, order: async () => ({ data: [], error: null }) };
    from.mockReturnValue(query);
    lookup.mockResolvedValue({ data: { id, vendor_id: vendorId, image_url: "inquiry-image:private" }, error: null });
    sign.mockImplementation(async (_client, inquiry) => ({ ...inquiry, image_url: "https://project.supabase.co/signed?token=short-lived" }));
  });
  it("未認証ではDBも署名も実行しない", async () => {
    auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await GET(request(), params())).status).toBe(401);
    expect(from).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled();
  });
  it("DBが他店舗の行を返しても署名しない", async () => {
    lookup.mockResolvedValue({ data: { vendor_id: "other", image_url: "inquiry-image:private" }, error: null });
    expect((await GET(request(), params())).status).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });
  it("所属店舗の権限を確認して署名し、共有キャッシュに残さない", async () => {
    const response = await GET(request(), params());
    expect(response.status).toBe(200);
    expect(sign).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).inquiry.image_url).toContain("token=short-lived");
  });
});
