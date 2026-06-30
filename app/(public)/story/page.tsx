import { Metadata } from "next";
import StoryGridClient from "./StoryGridClient";

export const metadata: Metadata = {
  title: "近況 | nicchyo日曜市",
  description: "出店者の今週の写真投稿をチェックしよう。",
};

export default function StoryPage() {
  return <StoryGridClient />;
}
