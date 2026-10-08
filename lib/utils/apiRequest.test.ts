import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./apiRequest";

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it("成功したら JSON を返す。本文があるときは JSON で送る", async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    expect(await apiRequest("/api/x", { method: "POST", body: { a: 1 } }, "失敗")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("失敗したら、API の文言・状態コード・コードを持つ ApiError を投げる", async () => {
    mockFetch(new Response(JSON.stringify({ error: "満員です", code: "full" }), { status: 409 }));

    await expect(apiRequest("/api/x", {}, "失敗")).rejects.toMatchObject({
      name: "ApiError",
      message: "満員です",
      status: 409,
      code: "full",
    });
  });

  it("文言が無い・JSON でない失敗、通信そのものの失敗は、fallback の文言にそろえる", async () => {
    mockFetch(new Response("<html>", { status: 502 }));
    await expect(apiRequest("/api/x", {}, "読み込めませんでした")).rejects.toMatchObject({
      message: "読み込めませんでした",
      status: 502,
    });

    mockFetch(new TypeError("network"));
    const error = await apiRequest("/api/x", {}, "電波を確かめてください").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "電波を確かめてください", status: 0 });
  });
});
