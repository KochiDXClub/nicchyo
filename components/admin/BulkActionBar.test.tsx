import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { BulkActionBar } from "./BulkActionBar";
import { useBulkAction } from "./useBulkAction";

vi.mock("@/lib/admin/toast", () => ({ showToast: { success: vi.fn(), error: vi.fn() } }));

describe("BulkActionBar", () => {
  it("選んだ件数と解除、操作を出す。0件のときは何も出さない", () => {
    const onClear = vi.fn();
    const { rerender } = render(<BulkActionBar count={3} unit="人" onClear={onClear}><button type="button">一括停止</button></BulkActionBar>);
    expect(screen.getByText("3人選択中")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "解除" }));
    expect(onClear).toHaveBeenCalled();
    rerender(<BulkActionBar count={0} onClear={onClear}><button type="button">x</button></BulkActionBar>);
    expect(screen.queryByRole("region", { name: "一括操作" })).toBeNull();
  });
});

describe("useBulkAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("確認 → API → 読み直しまで行い、成功したら true を返す。確認でやめたら何もしない", async () => {
    const onDone = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useBulkAction({ endpoint: "/api/x/bulk", unit: "件", subject: "店舗", onDone }));

    await act(async () => expect(await result.current.runBulk("suspend", ["a", "b"], "停止")).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    await act(async () => expect(await result.current.runBulk("suspend", ["a", "b"], "停止")).toBe(true));
    expect(confirmMock).toHaveBeenLastCalledWith("2件の店舗を一括停止しますか？");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ action: "suspend", ids: ["a", "b"] });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("API が失敗したら false を返し、読み直さない。削除の確認には添える一文が付く", async () => {
    const onDone = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "no" }), { status: 500 }));
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() =>
      useBulkAction({ endpoint: "/api/u/bulk", unit: "人", subject: "ユーザー", deleteWarning: "取り消せません。", onDone }),
    );
    await act(async () => expect(await result.current.runBulk("delete", ["a"], "削除")).toBe(false));
    expect(confirmMock).toHaveBeenCalledWith("1人のユーザーを一括削除しますか？取り消せません。");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("一部だけ失敗（207）したときは、エラーを出したうえで、成功した分が消えるよう読み直す", async () => {
    const onDone = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "1件の処理に失敗しました" }), { status: 207 }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useBulkAction({ endpoint: "/api/u/bulk", unit: "人", subject: "ユーザー", onDone }));
    await act(async () => expect(await result.current.runBulk("suspend", ["a", "b"], "停止")).toBe(false));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("ネットワークが失敗したら false を返し、読み直さない", async () => {
    const onDone = vi.fn();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useBulkAction({ endpoint: "/api/u/bulk", unit: "人", subject: "ユーザー", onDone }));
    await act(async () => expect(await result.current.runSingle("suspend", "a", "停止")).toBe(false));
    expect(onDone).not.toHaveBeenCalled();
  });
});
