"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { CircleHelp } from "lucide-react";
import { markToursDismissed, wasTourDismissed } from "@/lib/vendor/tourSession";
import { findVendorTourPage, type TourFeature } from "@/lib/vendor/tours";
import TourSheet from "./TourSheet";

/**
 * 出店者の画面の右上に「?」を出し、画面の説明パネルを開く。
 * 初めて開いた画面では、まだ見ていない機能の説明を自動で出す。「了解した」で閉じたら記録して、
 * 次からは自動では出さない。「?」は画面ごとに右上の1つだけで、その画面の機能の説明を順に何度でも見られる。
 *
 * 途中で閉じた（背景・Esc）説明は、記録には残さないが、同じセッションのあいだは自動で出し直さない。
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

  // 画面が変わったら、前の説明は閉じる
  const pagePath = page?.path ?? null;
  useEffect(() => {
    setShown(null);
  }, [pagePath]);

  // まだ見ていない機能があれば、その分だけ自動で開く。自動で開くのは、画面ごとに1回だけ
  // （「見た」の一覧が届く前に「?」で開いていたら、その説明を上書きしない。
  //  途中で閉じた機能は、同じセッションのあいだは、戻ってきても自動では開かない）
  const autoHandledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!page || !seen || autoHandledFor.current === page.path) return;
    autoHandledFor.current = page.path;
    const unseen = page.features.filter((feature) => !seen.has(feature.key) && !wasTourDismissed(feature.key));
    if (unseen.length > 0) setShown((current) => current ?? unseen);
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
            onDismiss={() => {
              markToursDismissed(shown.map((feature) => feature.key));
              setShown(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
