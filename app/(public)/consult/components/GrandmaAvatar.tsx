"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { GrandmaPose } from "@/lib/grandma/pose";

/**
 * 答え終わってすぐ待機に戻すと機械的に見えるので、少しだけ余韻を置く。
 * この「間」は fps を上げるより体感に効く。
 */
const SPEAKING_LINGER_MS = 800;

/**
 * 返答が終わったときだけ、待機に戻るのを遅らせる。
 * それ以外の遷移（マイクを押した瞬間など）は即時に反映する。
 */
function useLingeringPose(pose: GrandmaPose): GrandmaPose {
  const [displayed, setDisplayed] = useState<GrandmaPose>(pose);

  useEffect(() => {
    if (pose === "idle" && displayed === "speaking") {
      const timer = setTimeout(() => setDisplayed("idle"), SPEAKING_LINGER_MS);
      return () => clearTimeout(timer);
    }
    setDisplayed(pose);
  }, [pose, displayed]);

  return displayed;
}

export interface GrandmaAvatarProps {
  pose: GrandmaPose;
  className?: string;
}

/**
 * 相談ページのヘッダーに出るにちよさん。
 *
 * 会話の状態に合わせて姿勢が変わる（待機＝呼吸、聞いている＝前傾、
 * 考えている＝首をかしげる、答えている＝うなずく）。
 * 動きの定義は app/globals.css の .grandma-avatar 側にある。
 */
export default function GrandmaAvatar({ pose, className }: GrandmaAvatarProps) {
  const displayedPose = useLingeringPose(pose);

  return (
    <div className={`grandma-avatar ${className ?? ""}`} data-pose={displayedPose}>
      <div className="grandma-avatar__inner">
        <Image
          src="/characters/obaasan.png"
          alt="にちよさん"
          width={180}
          height={180}
          priority
          className="h-[120px] w-[120px] object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)] md:h-[180px] md:w-[180px]"
        />
      </div>
    </div>
  );
}
