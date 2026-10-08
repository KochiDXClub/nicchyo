import React, { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDialogFocus } from "./useDialogFocus";

function Dialog({ onClose, step }: { onClose: () => void; step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, step);
  return (
    <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
      <input aria-label={`入力${step}`} />
      <button type="button" onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}

function Page() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        開く
      </button>
      <button type="button" onClick={() => setStep((s) => s + 1)}>
        次へ
      </button>
      {open && <Dialog step={step} onClose={() => setOpen(false)} />}
    </>
  );
}

describe("useDialogFocus", () => {
  it("開くと中の最初の入力へ、閉じると開いたボタンへフォーカスを移す", () => {
    render(<Page />);
    const opener = screen.getByRole("button", { name: "開く" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("textbox", { name: "入力1" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(opener).toHaveFocus();
  });

  it("Tab は中で回り、背面へ出ない", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "開く" }));
    const close = screen.getByRole("button", { name: "閉じる" });
    close.focus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("textbox", { name: "入力1" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
  });
});

describe("useDialogFocus の data-autofocus", () => {
  function Preferred() {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(ref);
    return (
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
        <button type="button">説明の中のボタン</button>
        <button type="button" data-autofocus>
          主ボタン
        </button>
      </div>
    );
  }

  it("data-autofocus を付けた要素があれば、最初のボタンより先にそこへ当てる", () => {
    render(<Preferred />);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "主ボタン" }));
  });
});
