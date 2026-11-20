import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import InviteCopyField from "./InviteCopyField";

const url = "https://example.com/join/demo";

it("対象のURLをコピーして完了を知らせる", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<InviteCopyField url={url} />);
  fireEvent.click(screen.getByRole("button", { name: "コピー" }));
  expect(await screen.findByRole("button", { name: "コピー済み" })).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith(url);
});

it("クリップボードが使えないときはURLを選択して手動コピーに切り替える", async () => {
  Object.assign(navigator, { clipboard: undefined });
  render(<InviteCopyField url={url} />);
  fireEvent.click(screen.getByRole("button", { name: "コピー" }));
  expect(await screen.findByText(/長押ししてコピー/)).toBeVisible();
  const field = screen.getByRole("textbox") as HTMLInputElement;
  expect(field).toHaveFocus();
  expect(field.selectionEnd! - field.selectionStart!).toBe(url.length);
});
