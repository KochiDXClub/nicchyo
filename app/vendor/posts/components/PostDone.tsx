"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, Plus } from "lucide-react";
import { Button, buttonClass } from "@/components/ui";

type Props = {
  postId: string;
  imageUrl: string;
  expiresLabel: string;
  onAnother: () => void;
  onBack: () => void;
};

/** 出し終わったところ。近況でどう見えるかをすぐ見られるようにする */
export default function PostDone({ postId, imageUrl, expiresLabel, onAnother, onBack }: Props) {
  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <div className="relative aspect-[3/4] h-40">
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="7.5rem"
          className="rounded-card bg-black object-cover shadow-lift"
          // 端末の中の写真（blob URL）は最適化を通せない
          unoptimized={imageUrl.startsWith("blob:")}
        />
        <CheckCircle2
          size={40}
          aria-hidden="true"
          className="absolute -bottom-3 -right-3 rounded-chip bg-white text-emerald-500"
        />
      </div>
      <h2 role="status" className="mt-6 text-2xl font-bold text-nicchyo-ink">近況に出しました！</h2>
      <p className="mt-1 text-sm text-nicchyo-ink/70">{expiresLabel}、近況とマップのお店に出ます</p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Link href={`/story?content=${encodeURIComponent(postId)}`} className={buttonClass({ size: "lg" })}>
          <Eye size={18} aria-hidden="true" />
          近況で見てみる
        </Link>
        <Button variant="secondary" size="lg" onClick={onAnother}>
          <Plus size={18} aria-hidden="true" />
          もう1枚出す
        </Button>
        <Button variant="ghost" onClick={onBack}>
          投稿の一覧に戻る
        </Button>
      </div>
    </div>
  );
}
