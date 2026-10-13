import { renderHook, render, screen } from "@testing-library/react";
import { useKeyboardShortcuts, ShortcutHelp } from "./useKeyboardShortcuts";
import { expect, test, describe, vi } from "vitest";

describe("useKeyboardShortcuts", () => {
  test("triggers shortcut action when correct keys are pressed", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "s", ctrl: true, description: "Save", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
    window.dispatchEvent(event);

    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  test("does not trigger action when modifier keys do not match", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "s", ctrl: true, description: "Save", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: false });
    window.dispatchEvent(event);

    expect(actionMock).not.toHaveBeenCalled();
  });

  test("does not trigger action when inside INPUT or TEXTAREA", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "s", ctrl: true, description: "Save", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);

    // Simulate focusing and pressing a key in the input
    input.focus();
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    input.dispatchEvent(event);

    expect(actionMock).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  test("does not trigger action when inside contentEditable", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "s", ctrl: true, description: "Save", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const div = document.createElement("div");
    // Using property assignment isn't enough in JSDOM, it needs to be an attribute,
    // or we mock the isContentEditable property. JSDOM doesn't support isContentEditable fully.
    Object.defineProperty(div, "isContentEditable", { value: true });
    document.body.appendChild(div);

    // Simulate focusing and pressing a key in the contentEditable
    div.focus();
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    div.dispatchEvent(event);

    expect(actionMock).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  test("special case: allows Ctrl+A outside of input fields", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "a", ctrl: true, description: "Select All", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true });
    window.dispatchEvent(event);

    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  test("special case: prevents Ctrl+A inside input fields", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "a", ctrl: true, description: "Select All", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true });
    input.dispatchEvent(event);

    expect(actionMock).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  test("supports meta key (Mac Command)", () => {
    const actionMock = vi.fn();
    const shortcuts = [
      { key: "s", ctrl: true, description: "Save", action: actionMock },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // useKeyboardShortcuts treats metaKey like ctrlKey
    const event = new KeyboardEvent("keydown", { key: "s", metaKey: true });
    window.dispatchEvent(event);

    expect(actionMock).toHaveBeenCalledTimes(1);
  });
});

describe("ShortcutHelp component", () => {
  test("renders shortcuts correctly", () => {
    const shortcuts = [
      { key: "s", ctrl: true, description: "Save", action: () => {} },
      { key: "a", ctrl: true, shift: true, alt: true, description: "Magic", action: () => {} },
      { key: "/", description: "Search", action: () => {} },
    ];

    render(<ShortcutHelp shortcuts={shortcuts} />);

    // 見出しは、開くモーダル側（ShortcutHelpLauncher）が持つ
    expect(screen.queryByText("キーボードショートカット")).not.toBeInTheDocument();

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Ctrl + S")).toBeInTheDocument();

    expect(screen.getByText("Magic")).toBeInTheDocument();
    expect(screen.getByText("Ctrl + Shift + Alt + A")).toBeInTheDocument();

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });
});
