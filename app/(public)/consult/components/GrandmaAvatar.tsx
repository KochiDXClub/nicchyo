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

/**
 * hero  … 待機中の主役。これ自体が音声入力ボタンになる
 * compact … 答えが出たあと、上に退いた状態
 */
export type GrandmaAvatarSize = "hero" | "compact";

const SIZE_CLASS: Record<GrandmaAvatarSize, string> = {
  hero: "h-[200px] w-[200px] md:h-[240px] md:w-[240px]",
  compact: "h-[72px] w-[72px] md:h-[88px] md:w-[88px]",
};

export interface GrandmaAvatarProps {
  pose: GrandmaPose;
  size?: GrandmaAvatarSize;
  /** 渡すとボタンになる。歩きながら片手で押せるよう、絵そのものを当たり判定にする */
  onClick?: () => void;
  label?: string;
  className?: string;
}

/**
 * にちよさん。
 *
 * 会話の状態に合わせて姿勢が変わる（待機＝呼吸、聞いている＝前傾、
 * 考えている＝首をかしげる、答えている＝うなずく）。
 * 動きの定義は app/globals.css の .grandma-avatar 側にある。
 */
export default function GrandmaAvatar({
  pose,
  size = "compact",
  onClick,
  label,
  className,
}: GrandmaAvatarProps) {
  const displayedPose = useLingeringPose(pose);

  const picture = (
    <div className="grandma-avatar__inner">
      <Image
        src="/characters/obaasan.png"
        alt="にちよさん"
        width={240}
        height={240}
        priority
        className={`${SIZE_CLASS[size]} object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)] transition-[height,width] duration-300`}
      />
    </div>
  );

  if (!onClick) {
    return (
      <div className={`grandma-avatar ${className ?? ""}`} data-pose={displayedPose}>
        {picture}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grandma-avatar grandma-avatar--tappable ${className ?? ""}`}
      data-pose={displayedPose}
    >
      {picture}
    </button>
  );
}
