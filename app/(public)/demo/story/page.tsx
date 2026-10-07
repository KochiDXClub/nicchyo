import { Metadata } from "next";
import DemoStoryClient from "./DemoStoryClient";

export const metadata: Metadata = {
  title: "近況（デモ）",
  description: "出店者の近況がどう届くかを、見本の投稿で試せるデモです。",
  robots: { index: false },
};

export default function DemoStoryPage() {
  return <DemoStoryClient />;
}
