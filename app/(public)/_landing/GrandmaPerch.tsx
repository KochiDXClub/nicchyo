import { cn } from "@/lib/utils/cn";
import type { LandingSectionKey } from "./content";

/**
 * にちよさんの着地点。中身は空で、場所と大きさだけを持つ。
 * LandingGrandma がこの箱を探して、見えているときはここへ降りてくる。
 * 大きさは className で決める（正方形にする）
 */
export default function GrandmaPerch({ section, className }: { section: LandingSectionKey; className?: string }) {
  return <div aria-hidden data-grandma-perch={section} className={cn("pointer-events-none h-24 w-24", className)} />;
}
