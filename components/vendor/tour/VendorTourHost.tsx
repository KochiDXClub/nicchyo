"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { CircleHelp } from "lucide-react";
import { findVendorTourPage, type TourFeature } from "@/lib/vendor/tours";
import TourSheet from "./TourSheet";

/**
 * 出店者の画面の右上に「?」を出し、画面の説明パネルを開く。
 * 初めて開いた画面では、まだ見ていない機能の説明を自動で出す。「了解した」で閉じたら記録して、
 * 次からは自動では出さない。「?」は画面ごとに右上の1つだけで、その画面の機能の説明を順に何度でも見られる。
 *
 * 記録が読めなかったとき（通信の失敗など）は、自動では出さない。
 * 説明は読めなくても仕事の邪魔にならないが、毎回出ると邪魔になるため。
 */
export default function VendorTourHost() {
  const pathname = usePathname();
  const page = findVendorTourPage(pathname);
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  const [shown, setShown] = useState<readonly TourFeature[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vendor/tours", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ seen?: string[] }>) : null))
      .then((body) => {
        // 読めなかったときは null のまま（「まだ見ていない」と取り違えて自動で開かない）
        if (body) setSeen(new Set(body.seen ?? []));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // 画面が変わったら前の説明は閉じ、まだ見ていない機能があれば、その分だけ自動で開く
  useEffect(() => {
    const unseen = page && seen ? page.features.filter((feature) => !seen.has(feature.key)) : [];
    setShown(unseen.length > 0 ? unseen : null);
  }, [page, seen]);

  const acknowledge = useCallback(() => {
    const keys = (shown ?? []).map((feature) => feature.key);
    setShown(null);
    if (keys.length === 0) return;
    setSeen((prev) => new Set([...(prev ?? []), ...keys]));
    // 記録できなくても画面は閉じたまま。次に開いたときにもう一度出るだけ
    void fetch("/api/vendor/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    }).catch(() => {});
  }, [shown]);

  if (!page) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShown(page.features)}
        aria-label={`「${page.screenName}」の説明を見る`}
        className="fixed right-3 top-[calc(var(--safe-top,0px)+0.75rem)] z-[9990] flex h-10 w-10 items-center justify-center rounded-full bg-white text-amber-600 shadow-chip ring-1 ring-line transition hover:bg-amber-50 active:scale-95 motion-reduce:active:scale-100"
      >
        <CircleHelp size={22} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {shown && (
          <TourSheet
            key={shown.map((feature) => feature.key).join("+")}
            screenName={page.screenName}
            showFeatureName={page.features.length > 1}
            features={shown}
            onAcknowledge={acknowledge}
            onDismiss={() => setShown(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
