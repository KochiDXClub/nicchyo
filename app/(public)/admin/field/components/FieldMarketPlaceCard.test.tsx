import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FieldMarketPlaceCard } from "./FieldMarketPlaceCard";
vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("他の店舗が使う場所は一度確認してから登録する", async () => {
  const place = { id: "place", store_number: 1, place_name: "一丁目 南 2", vendors: [{ id: "another", name: "別の店舗" }] };
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      return body.confirmed ? new Response(JSON.stringify({ ok: true }), { status: 200 }) : new Response(JSON.stringify({ error: "同じ場所です", needsConfirmation: true, count: 1 }), { status: 409 });
    }
    return new Response(JSON.stringify({ currentLocationId: null, places: [place] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<FieldMarketPlaceCard shopId="test" updatedAt={null} onSaved={onSaved} />);
  fireEvent.change(await screen.findByLabelText("地図の区画"), { target: { value: "place" } });
  expect(screen.getByLabelText("出店場所名")).toHaveValue("一丁目 南 2");
  fireEvent.click(screen.getByRole("button", { name: "出店場所を保存" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(confirm).toHaveBeenCalledTimes(1);
  const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(writes.map(([, init]) => JSON.parse(String(init?.body)).confirmed)).toEqual([false, true]);
});
it("重複の確認でキャンセルしたら登録を続行しない", async () => {
  const place = { id: "place", store_number: 1, place_name: "一丁目 南 2", vendors: [{ id: "another", name: "別の店舗" }] };
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => init?.method === "PUT"
    ? new Response(JSON.stringify({ error: "同じ場所です", needsConfirmation: true, count: 1 }), { status: 409 })
    : new Response(JSON.stringify({ currentLocationId: null, places: [place] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<FieldMarketPlaceCard shopId="test" updatedAt={null} onSaved={onSaved} />);
  fireEvent.change(await screen.findByLabelText("地図の区画"), { target: { value: "place" } });
  fireEvent.click(screen.getByRole("button", { name: "出店場所を保存" }));
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
  expect(onSaved).not.toHaveBeenCalled();
});
it("場所名の変更は既存の名前を照合し、全店舗への反映を確認する", async () => {
  const place = { id: "place", store_number: 1, place_name: "旧名称", vendors: [{ id: "test", name: "自分の店舗" }] };
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      return body.confirmed ? new Response(JSON.stringify({ ok: true }), { status: 200 }) : new Response(JSON.stringify({ error: "全店舗に反映されます", needsConfirmation: true, count: 0 }), { status: 409 });
    }
    return new Response(JSON.stringify({ currentLocationId: "place", places: [place] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(<FieldMarketPlaceCard shopId="test" updatedAt={null} onSaved={onSaved} />);
  fireEvent.change(await screen.findByLabelText("出店場所名"), { target: { value: "新名称" } });
  fireEvent.click(screen.getByRole("button", { name: "出店場所を保存" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("全店舗"));
  const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(writes.map(([, init]) => JSON.parse(String(init?.body)).expectedName)).toEqual(["旧名称", "旧名称"]);
});
