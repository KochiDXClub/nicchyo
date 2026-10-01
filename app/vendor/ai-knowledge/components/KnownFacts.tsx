"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Surface } from "@/components/ui";
import { getUpcomingSundayIso } from "@/lib/market/calendar";
import { studioQuestions, type VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import { fetchAskSnapshot } from "../../_services/askService";

/**
 * にちよさんが、店舗情報の編集ですでに知っていること。
 * 同じことをノートに二度書かなくていいように、読むだけの形で見せる。
 * 読めなかったときは何も出さない（ノートを書く邪魔をしない）。
 */
export default function KnownFacts({ vendorId }: { vendorId: string }) {
  const [snapshot, setSnapshot] = useState<VendorAskSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAskSnapshot(vendorId, getUpcomingSundayIso())
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const groups = useMemo(() => {
    if (!snapshot) return [];
    return studioQuestions(snapshot)
      .map((group) => ({
        key: group.key,
        title: group.title,
        emoji: group.emoji,
        summaries: group.questions
          .map((question) => question.summary(snapshot))
          .filter((summary): summary is string => !!summary),
      }))
      .filter((group) => group.summaries.length > 0);
  }, [snapshot]);

  if (groups.length === 0) return null;

  return (
    <Surface>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-nicchyo-ink [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">にちよさんがもう知っていること</span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
        </summary>
        <p className="mt-2 text-sm text-nicchyo-ink/70">
          店舗情報で答えたことは、ノートに書かんでも伝わっちょります。ここに無いことだけ書いてや。
        </p>
        <dl className="mt-3 space-y-2.5">
          {groups.map((group) => (
            <div key={group.key}>
              <dt className="text-sm font-semibold text-nicchyo-ink/70">
                <span aria-hidden="true">{group.emoji} </span>
                {group.title}
              </dt>
              <dd className="text-sm leading-relaxed text-nicchyo-ink">{group.summaries.join("・")}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/vendor/store"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-800 underline underline-offset-2"
        >
          店舗情報で直す
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </details>
    </Surface>
  );
}
