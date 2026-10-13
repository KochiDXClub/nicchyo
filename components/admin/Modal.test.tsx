import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Modal } from "./Modal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>開く</button>
      <Modal open={open} onClose={() => setOpen(false)} title="招待">
        <input aria-label="メール" autoFocus />
      </Modal>
    </>
  );
}

describe("Modal のフォーカス", () => {
  it("中の入力欄に autoFocus があれば、それを奪わない。閉じたら開いたボタンに戻す", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "開く" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByLabelText("メール"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(opener);
  });
});
