import { useEffect, type RefObject } from "react";

/**
 * 開いている小さなメニューを、外側を押したとき・Esc を押したときに閉じる。
 * open が false の間は何も購読しない。
 */
export function useDismissOnOutside(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // onDismiss は毎回作り直されても購読し直さない（open と root だけで決める）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rootRef]);
}
