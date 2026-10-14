import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * 各セクションに置いておくにちよさん。飾りなので読み上げない。
 * 大きさと置き場所は className で決める（正方形にする）
 */
export default function GrandmaFigure({ className }: { className?: string }) {
  return (
    <Image
      src="/images/obaasan_transparent.webp"
      alt=""
      width={112}
      height={112}
      className={cn("pointer-events-none h-24 w-24 object-contain drop-shadow-md", className)}
    />
  );
}
