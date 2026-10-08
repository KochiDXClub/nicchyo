import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

function Page({ dirty, confirmOnLinkClick }: { dirty: boolean; confirmOnLinkClick?: boolean }) {
  useUnsavedChangesWarning(dirty, { confirmOnLinkClick });
  return (
    <div>
      <a href="/admin/other" onClick={(e) => e.preventDefault()}>
        別のページ
      </a>
      <a href="#section">同じページ内</a>
    </div>
  );
}

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useUnsavedChangesWarning", () => {
  it("未保存の変更があるときだけ beforeunload を止める", () => {
    const { rerender } = render(<Page dirty={false} />);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    rerender(<Page dirty />);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });

  it("confirmOnLinkClick のとき、別ページへのリンクで確認を出し、キャンセルならリンクの処理まで届かせない", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByText } = render(<Page dirty confirmOnLinkClick />);
    const link = getByText("別のページ");
    const onLinkClick = vi.fn();
    link.addEventListener("click", onLinkClick);

    fireEvent.click(link);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  it("確認で OK を選べばそのまま進み、同じページ内のリンクでは確認しない", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { getByText } = render(<Page dirty confirmOnLinkClick />);
    const link = getByText("別のページ");
    const onLinkClick = vi.fn();
    link.addEventListener("click", onLinkClick);

    fireEvent.click(link);
    expect(onLinkClick).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("同じページ内"));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("confirmOnLinkClick を指定しなければリンクでは確認しない", () => {
    const confirm = vi.spyOn(window, "confirm");
    const { getByText } = render(<Page dirty />);
    fireEvent.click(getByText("別のページ"));
    expect(confirm).not.toHaveBeenCalled();
  });
});
