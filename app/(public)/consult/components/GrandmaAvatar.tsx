"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { GrandmaPose } from "@/lib/grandma/pose";
import {
  DEFAULT_CONSULT_CHARACTER,
  DEFAULT_CONSULT_CHARACTER_ID,
  type ConsultCharacter,
} from "../data/consultCharacters";

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
 * hero   … 既定。これ自体が音声入力ボタンになる
 * pinned … 読むために利用者がスクロールしたときだけ、場所を空けるために縮む
 *
 * 大きさを決めてよいのは「利用者が読む場所を必要としているか」だけで、
 * 「答えがあるかどうか」ではない。アプリの状態で勝手に縮むと、
 * なぜ縮んだのかが利用者に分からず、話し相手が急に遠ざかったように見える。
 */
export type GrandmaAvatarSize = "hero" | "pinned";

const SIZE_CLASS: Record<GrandmaAvatarSize, string> = {
  // 縦の短い端末（iPhone SE など）では、候補ボタン3つが下端固定の
  // 「話しかける」に隠れてしまうので、その分だけキャラを小さくする。
  // 幅ではなく高さで切り替えるのは、足りなくなるのが縦だけのため
  hero: "h-[168px] w-[168px] [@media(min-height:700px)]:h-[200px] [@media(min-height:700px)]:w-[200px] md:h-[240px] md:w-[240px]",
  // 固定バーに常駐する取っ手。大きさは変えず、出入りだけさせる
  pinned: "h-[64px] w-[64px] md:h-[72px] md:w-[72px]",
};

export interface GrandmaAvatarProps {
  pose: GrandmaPose;
  size?: GrandmaAvatarSize;
  /** 渡すとボタンになる。歩きながら片手で押せるよう、絵そのものを当たり判定にする */
  onClick?: () => void;
  label?: string;
  className?: string;
  /** 今の話し手。省略すると既定のにちよさん */
  character?: ConsultCharacter;
}

/**
 * 今の話し手。
 *
 * 会話の状態に合わせて姿勢が変わる（待機＝呼吸、聞いている＝前傾、
 * 考えている＝首をかしげる、答えている＝うなずく）。
 * 動きの定義は app/globals.css の .grandma-avatar 側にある。
 *
 * にちよさんだけ専用の切り抜き（/characters/obaasan.png）を使う。
 * 他のキャラは一覧と同じ画像を使うので、拡大率と位置を行から引く。
 */
export default function GrandmaAvatar({
  pose,
  size = "hero",
  onClick,
  label,
  className,
  character = DEFAULT_CONSULT_CHARACTER,
}: GrandmaAvatarProps) {
  const displayedPose = useLingeringPose(pose);
  const isDefaultCharacter = character.id === DEFAULT_CONSULT_CHARACTER_ID;

  const picture = (
    <div className="grandma-avatar__inner">
      <Image
        src={isDefaultCharacter ? "/characters/obaasan.png" : character.image}
        alt={character.name}
        width={240}
        height={240}
        priority
        className={`${SIZE_CLASS[size]} object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)] ${
          isDefaultCharacter ? "" : character.imageScale
        }`}
        style={isDefaultCharacter ? undefined : { objectPosition: character.imagePosition }}
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
