import NextImage from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { Surface } from "@/components/ui";

interface ReviewCardProps {
  /** 写真。null は「写真なし」の枠を出す。undefined なら枠ごと出さない */
  image?: string | null;
  /** 見出しの行に並べる札（店名・状態など） */
  badges?: React.ReactNode;
  /** 本文 */
  children: React.ReactNode;
  /** 本文の下の補足（日時など） */
  meta?: React.ReactNode;
  /** 右端に縦に並べる操作 */
  actions?: React.ReactNode;
}

/**
 * 「1件ずつ確認して、非表示にする・削除する」一覧の1行。
 * 投稿の確認で使っていた形を、ほかの確認画面でも使えるよう切り出したもの。
 */
export function ReviewCard({ image, badges, children, meta, actions }: ReviewCardProps) {
  return (
    <Surface as="li" padding="sm" className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {image !== undefined &&
          (image ? (
            <NextImage src={image} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-btn object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-btn bg-nicchyo-ink/[0.06]">
              <ImageIcon size={20} aria-hidden="true" className="text-nicchyo-ink/40" />
            </div>
          ))}
        <div className="min-w-0 flex-1">
          {badges && <div className="mb-1 flex flex-wrap items-center gap-2">{badges}</div>}
          {children}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-nicchyo-ink/55">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 gap-2 sm:flex-col">{actions}</div>}
    </Surface>
  );
}
