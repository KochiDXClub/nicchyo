"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/ui";
import StoryGridClient from "../../story/StoryGridClient";
import { buildDemoStories } from "./demoStories";

/**
 * 見本の投稿は開いた時刻から逆算して作る。サーバーで作ると、ビルド時や描画時の
 * 時刻と画面の「○分前」がずれるので、ブラウザに来てから作る。
 */
export default function DemoStoryClient() {
  const [demo, setDemo] = useState<ReturnType<typeof buildDemoStories> | null>(null);

  useEffect(() => {
    setDemo(buildDemoStories(Date.now()));
  }, []);

  if (!demo) return <PageShell as="main" />;
  return <StoryGridClient demo={demo} />;
}
