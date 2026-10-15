"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 画面に入っているあいだだけ data-visible="true" にする。
 * ずっと動く飾り（屋台通りの横流れなど）を、画面の外では止めて、電池と描画の負担を減らすのに使う。
 * once を付けると、一度見えたら true のままにする（一度だけ書かれる手描き文字などに使う）。
 * IntersectionObserver が無い環境では、最初から true（止めずに動かす）
 */
export default function InView({
  children,
  className,
  once = false,
}: {
  children: ReactNode;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        if (once) observer.disconnect();
      } else if (!once) {
        setVisible(false);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div ref={ref} data-visible={visible} className={className}>
      {children}
    </div>
  );
}
