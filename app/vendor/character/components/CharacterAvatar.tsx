import Image from "next/image";
import { cn } from "@/lib/utils/cn";

type Props = {
  name: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = { sm: "h-12 w-12 text-lg", md: "h-16 w-16 text-2xl", lg: "h-24 w-24 text-4xl" } as const;

/** キャラの顔。画像が無いキャラは頭文字の丸で出す（モック中の仮表示） */
export default function CharacterAvatar({ name, image, size = "md", className }: Props) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-chip bg-amber-100 font-bold text-amber-800 ring-1 ring-amber-200",
        sizeClass[size],
        className
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes="6rem"
          className="object-cover"
          // 端末の中のイラスト（blob URL）は最適化を通せない
          unoptimized={image.startsWith("blob:")}
        />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0) || "？"}</span>
      )}
    </span>
  );
}
