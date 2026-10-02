"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { CircleHelp } from "lucide-react";
import { findVendorTour } from "@/lib/vendor/tours";
import TourSheet from "./TourSheet";

/**
 * 出店者の画面の右上に「?」を出し、画面の説明パネルを開く。
 * 初めて開いた画面では自動で出し、「了解した」で閉じたら記録して、次からは自動では出さない。
 * 「?」からは何度でも見られる。
 *
 * 記録が読めなかったとき（通信の失敗など）は、自動では出さない。
 * 説明は読めなくても仕事の邪魔にならないが、毎回出ると邪魔になるため。
 */
export default function VendorTourHost() {
  const pathname = usePathname();
  const tour = findVendorTour(pathname);
  const tourKey = tour?.key ?? null;
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

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

  // 画面が変わったら前の説明は閉じ、まだ見ていない画面なら自動で開く
  useEffect(() => {
    setOpenKey(seen && tourKey && !seen.has(tourKey) ? tourKey : null);
  }, [tourKey, seen]);

  const acknowledge = useCallback(() => {
    if (!tourKey) return;
    setOpenKey(null);
    setSeen((prev) => new Set(prev ?? []).add(tourKey));
    // 記録できなくても画面は閉じたまま。次に開いたときにもう一度出るだけ
    void fetch("/api/vendor/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: tourKey }),
    }).catch(() => {});
  }, [tourKey]);

  if (!tour) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenKey(tour.key)}
        aria-label={`「${tour.screenName}」の説明を見る`}
        className="fixed right-3 top-[calc(var(--safe-top,0px)+0.75rem)] z-[9990] flex h-10 w-10 items-center justify-center rounded-full bg-white text-amber-600 shadow-chip ring-1 ring-line transition hover:bg-amber-50 active:scale-95 motion-reduce:active:scale-100"
      >
        <CircleHelp size={22} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {openKey === tour.key && (
          <TourSheet
            key={tour.key}
            tour={tour}
            onAcknowledge={acknowledge}
            onDismiss={() => setOpenKey(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
