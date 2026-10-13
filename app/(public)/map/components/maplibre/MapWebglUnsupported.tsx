"use client";

import Link from "next/link";
import { EmptyState, buttonClass } from "@/components/ui";

/**
 * WebGL が使えない端末・ブラウザで、地図の代わりに出す案内。
 * 地図が出なくても店を探せるよう、店舗検索へつなぐ。
 */
export default function MapWebglUnsupported() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-nicchyo-base">
      <EmptyState
        icon="🗺️"
        title="この端末では地図を表示できません"
        description="地図の表示には WebGL が必要です。ブラウザを更新するか、ほかのブラウザでお試しください。店は検索から探せます。"
        action={
          <Link href="/search" className={buttonClass({ variant: "primary" })}>
            店を検索する
          </Link>
        }
        bordered={false}
      />
    </div>
  );
}
