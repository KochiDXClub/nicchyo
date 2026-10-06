import Link from "next/link";
import { Badge, EmptyMessage, Surface, buttonClass } from "@/components/ui";
import type { AiConsultAnalytics } from "../../_types";

const TOPIC_LIMIT = 4;
const KEYWORD_LIMIT = 8;

/** お客さんがにちよさんに聞いたこと。答えをノートに書いておく導線をつける */
export default function QuestionsSection({ consult }: { consult: AiConsultAnalytics }) {
  const topics = consult.topics.slice(0, TOPIC_LIMIT);
  const keywords = consult.keywords.slice(0, KEYWORD_LIMIT);
  const maxTopic = topics[0]?.count ?? 1;

  return (
    <Surface as="section" aria-labelledby="questions-title">
      <h2 id="questions-title" className="font-display text-xl text-nicchyo-ink">
        お客さんが気になっていること
      </h2>

      {consult.totalCount === 0 ? (
        <EmptyMessage message="まだ、このお店についての相談はありません" padding="py-6" />
      ) : (
        <>
          <p className="mt-1 text-sm text-nicchyo-ink/70">
            にちよさんに、この1週間で {consult.totalCount.toLocaleString("ja-JP")}件の相談がありました
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {topics.map((topic) => (
              <li key={topic.category}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-nicchyo-ink">{topic.category}について</span>
                  <span className="font-bold tabular-nums text-nicchyo-ink">{topic.count}件</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-chip bg-nicchyo-ink/10">
                  <div
                    className="h-full rounded-chip bg-amber-400"
                    style={{ width: `${Math.round((topic.count / maxTopic) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {keywords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {keywords.map((item) => (
                <Badge key={item.keyword}>
                  {item.keyword}
                  <span className="text-nicchyo-ink/40">{item.count}</span>
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">
              聞かれることの答えを、にちよさんに教えておくと、お客さんにそのまま伝わります。
            </p>
            <Link
              href="/vendor/ai-knowledge"
              className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3" })}
            >
              にちよさんに教えておく
            </Link>
          </div>
        </>
      )}
    </Surface>
  );
}
