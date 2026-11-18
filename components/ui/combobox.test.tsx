import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Combobox } from "./combobox";

const options = [
  { value: "a", label: "三丁目 / 住所 183-1" },
  { value: "b", label: "二丁目 / 住所 184" },
  { value: "c", label: "一丁目 / 住所 185", description: "角" },
];

function Harness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <Combobox label="場所を選ぶ" options={options} value={value} onChange={(next) => { setValue(next); onChange(next); }} />;
}

describe("Combobox", () => {
  it("入力で候補を絞り込み、クリックで選ぶ", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "場所を選ぶ" });
    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.change(input, { target: { value: "184" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole("option", { name: /184/ }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect((input as HTMLInputElement).value).toContain("184");
  });

  it("矢印キーと Enter で選び、Escape で閉じる", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "場所を選ぶ" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("c");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("一致する候補がないときは案内を出す", () => {
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "場所を選ぶ" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "存在しない" } });
    expect(screen.getByText("一致する候補がありません")).toBeTruthy();
  });

  it("日本語入力の変換確定の Enter では候補を選ばない", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "場所を選ぶ" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "184" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("選んだあと、同じ入力欄をクリックすると候補がまた開く", () => {
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "場所を選ぶ" });
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole("option", { name: /184/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(input);
    expect(screen.getByRole("listbox")).toBeTruthy();
  });
});
