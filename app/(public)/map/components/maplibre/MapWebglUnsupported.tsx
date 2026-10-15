"use client";

import Link from "next/link";
import { EmptyState, buttonClass } from "@/components/ui";

/**
 * WebGL が使えない端末・ブラウザで、地図の代わりに出す案内。
 * 地図が出なくても店を探せるよう、にちよさん（相談）へつなぐ。
 * 以前は店舗検索ページ（/search）へつないでいたが、そのページは地図の検索に一本化して無くなった
 * （/search は /map へ転送されるため、ここから /map へ戻すとこの画面に戻って堂々巡りになる）。
 */
export default function MapWebglUnsupported() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-nicchyo-base">
      <EmptyState
        icon="🗺️"
        title="この端末では地図を表示できません"
        description="地図の表示には WebGL が必要です。ブラウザを更新するか、ほかのブラウザでお試しください。お店のことは、にちよさんに聞けます。"
        action={
          <Link href="/consult" className={buttonClass({ variant: "primary" })}>
            にちよさんに聞く
          </Link>
        }
        bordered={false}
      />
    </div>
  );
}
