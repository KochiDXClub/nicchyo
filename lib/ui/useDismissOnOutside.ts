import { useEffect, useRef, type RefObject } from "react";

/**
 * 開いている小さなメニューを、外側を押したとき・Esc を押したときに閉じる。
 * open が false の間は何も購読しない。
 */
export function useDismissOnOutside(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: () => void
) {
  // onDismiss は毎回作り直されても購読し直さず、常に最新のものを呼ぶ
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) dismissRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef]);
}
