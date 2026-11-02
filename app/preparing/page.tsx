import type { Metadata } from "next";
import PreparingNotice from "../components/PreparingNotice";

export const metadata: Metadata = {
  title: "準備中",
  robots: { index: false, follow: false },
};

// ページ公開設定で「準備中」にしたページの代わりに、proxy.ts がこのページへ差し替える
export default function PreparingPage() {
  return <PreparingNotice />;
}
