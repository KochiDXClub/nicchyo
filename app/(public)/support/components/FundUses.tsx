import { Globe, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import Reveal from "@/components/Reveal";
import { Surface } from "@/components/ui";
import type { FundUse } from "../costs";

/**
 * ご支援の使い道
 *
 * 金額は出さない（costs.ts の冒頭）。何に使うかを3つの面に分けて並べ、
 * 左から順に現れるようにする。並べた3つ以外にも、続けるために必要なことには
 * 使うので、そのことを最後に1行で添える。
 */

const ICONS: Record<FundUse["kind"], LucideIcon> = {
  domain: Globe,
  devops: Wrench,
  ai: Sparkles,
};

export default function FundUses({ uses }: { uses: FundUse[] }) {
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {uses.map((use, index) => {
          const Icon = ICONS[use.kind];
          return (
            <li key={use.title}>
              <Reveal className="h-full" delay={index * 0.12}>
                {/* 狭い画面では絵柄を横に置いて背を低くし、広い画面では上に置いて3枚を並べる */}
                <Surface elevation="flat" className="flex h-full gap-4 sm:block">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-chip bg-amber-100 text-amber-700"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="block sm:mt-4">
                    <span className="block text-[15px] font-bold">{use.title}</span>
                    <span className="mt-1.5 block text-[12.5px] leading-[1.85] text-nicchyo-ink/70">
                      {use.body}
                    </span>
                  </span>
                </Surface>
              </Reveal>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-[13px] leading-[1.9] text-nicchyo-ink/70">
        このほかにも、nicchyo プロジェクトを続けるために必要なことに使わせていただきます。
      </p>
    </div>
  );
}
