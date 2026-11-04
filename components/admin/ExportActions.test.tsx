import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExportActions } from "./ExportActions";
import { ReviewStats } from "./ReviewStats";

function openMenu() {
  const trigger = screen.getByRole("button", { name: /出力/ });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
}

describe("ExportActions", () => {
  it("compact では出力メニューから CSV と JSON の両方を出力できる", async () => {
    const onCsv = vi.fn();
    const onJson = vi.fn();
    render(<ExportActions compact onCsv={onCsv} onJson={onJson} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "CSV出力" }));
    expect(onCsv).toHaveBeenCalledTimes(1);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "JSON出力" }));
    expect(onJson).toHaveBeenCalledTimes(1);
  });

  it("compact で出力中はボタンを押せない", () => {
    render(<ExportActions compact onCsv={() => {}} onJson={() => {}} loading />);
    const trigger = screen.getByRole("button", { name: /出力中/ }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });

  it("通常表示では CSV と JSON のボタンが並ぶ", () => {
    render(<ExportActions onCsv={() => {}} onJson={() => {}} />);
    expect(screen.getByRole("button", { name: "CSVファイルをエクスポート" })).toBeTruthy();
  });
});

describe("ReviewStats compact", () => {
  it("compact でもラベルと件数を表示する", () => {
    render(<ReviewStats compact items={[{ label: "総ユーザー数", value: 3 }, { label: "管理者", value: 1 }, { label: "出店者", value: 2 }]} />);
    expect(screen.getByText("総ユーザー数")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
