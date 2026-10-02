import type { Metadata } from "next";
import type { ReactNode } from "react";

// URL にトークンが入っているページ。検索に載せず、外部のページへ飛ぶときに URL（Referer）が渡らないようにする
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
