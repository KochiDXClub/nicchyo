import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { AdminDataTable, type DataColumn } from "./AdminDataTable";
import { useRowSelection } from "./useRowSelection";

type Row = { id: string; name: string };
const ROWS: Row[] = [
  { id: "a", name: "山田農園" },
  { id: "b", name: "田中商店" },
  { id: "c", name: "佐藤青果" },
];
const COLUMNS: DataColumn<Row>[] = [{ key: "name", header: "店舗", sortKey: "name", render: (r) => r.name }];

function Harness({ onSort = () => {} }: { onSort?: (k: string) => void }) {
  const selection = useRowSelection(ROWS.map((r) => r.id));
  return (
    <AdminDataTable
      rows={ROWS}
      getRowId={(r) => r.id}
      columns={COLUMNS}
      sort={{ key: "name", direction: "asc", onSort }}
      selection={selection}
      selectionLabel={(r) => `${r.name}を選択`}
      actions={(r) => <button type="button">削除 {r.name}</button>}
    />
  );
}

describe("AdminDataTable", () => {
  it("本物の table として、見出し・行・操作を出す（tbody の中に div を入れない）", () => {
    const { container } = render(<Harness />);
    expect(screen.getAllByRole("row")).toHaveLength(1 + ROWS.length);
    expect(screen.getByRole("columnheader", { name: /店舗/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(container.querySelector("tbody > div")).toBeNull();
    expect(screen.getByRole("button", { name: "削除 田中商店" })).toBeTruthy();
  });

  it("見出しを押すと並べ替えを通知する", () => {
    const onSort = vi.fn();
    render(<Harness onSort={onSort} />);
    fireEvent.click(within(screen.getByRole("columnheader", { name: /店舗/ })).getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("チェックボックスで行を選び、全選択でき、Shift で範囲を選べる", () => {
    render(<Harness />);
    const boxes = () => screen.getAllByRole("checkbox") as HTMLInputElement[];
    fireEvent.click(screen.getByRole("checkbox", { name: "山田農園を選択" }));
    expect((screen.getByRole("checkbox", { name: "山田農園を選択" }) as HTMLInputElement).checked).toBe(true);
    // Shift で 3 つ目まで
    fireEvent.click(screen.getByRole("checkbox", { name: "佐藤青果を選択" }), { shiftKey: true });
    expect(boxes().every((b) => b.checked)).toBe(true); // 全選択のチェックも付く
  });

  it("スマホ用のカードを渡すと、表とは別にカードの一覧も出す", () => {
    render(
      <AdminDataTable rows={ROWS} getRowId={(r) => r.id} columns={COLUMNS} mobileCard={(r) => <span>card-{r.name}</span>} />,
    );
    expect(screen.getByText("card-山田農園")).toBeTruthy();
  });
});

describe("useRowSelection", () => {
  const ids = ["a", "b", "c", "d"];

  it("選択・解除・全選択・クリア", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    act(() => result.current.toggle("b", 1));
    expect(result.current.selectedIds).toEqual(["b"]);
    act(() => result.current.toggle("b", 1));
    expect(result.current.selectedIds).toEqual([]);
    act(() => result.current.toggleAll());
    expect(result.current.allSelected).toBe(true);
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual([]);
    act(() => result.current.toggle("a", 0));
    act(() => result.current.clear());
    expect(result.current.selectedIds).toEqual([]);
  });

  it("絞り込みで見えなくなった行は、選択からも外れる", () => {
    const { result, rerender } = renderHook(({ list }) => useRowSelection(list), { initialProps: { list: ids } });
    act(() => result.current.toggleAll());
    expect(result.current.selectedIds).toEqual(ids);
    rerender({ list: ["b", "c"] });
    expect(result.current.selectedIds).toEqual(["b", "c"]);
    expect(result.current.allSelected).toBe(true);
  });

  it("並べ替えのあとでも、Shift は前に選んだ行（id）を基準にする", () => {
    const { result, rerender } = renderHook(({ list }) => useRowSelection(list), { initialProps: { list: ids } });
    act(() => result.current.toggle("a", 0));
    rerender({ list: ["d", "c", "b", "a"] }); // a は末尾（3）へ
    act(() => result.current.toggle("c", 1, true));
    expect(result.current.selectedIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("Shift で、前に選んだ行との間をまとめて選ぶ", () => {
    const { result } = renderHook(() => useRowSelection(ids));
    act(() => result.current.toggle("a", 0));
    act(() => result.current.toggle("c", 2, true));
    expect(result.current.selectedIds.sort()).toEqual(["a", "b", "c"]);
  });
});
