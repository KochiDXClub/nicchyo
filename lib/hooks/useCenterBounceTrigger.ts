import { useEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * `root` の中で `target` が画面中央付近（上下28%を除いた帯）に入っているかを
 * IntersectionObserver で判定する。横スクロールのカルーセルで「今、中央に
 * 来ている1枚」を見た目で強調する（バウンスさせる）ために使う。
 */
export function useCenterBounceTrigger(
  rootRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>
) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const target = targetRef.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { setIsActive(entry.isIntersecting); },
      { root, threshold: 0.55, rootMargin: "-28% 0px -28% 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [rootRef, targetRef]);

  return isActive;
}
