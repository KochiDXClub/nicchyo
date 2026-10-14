"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyMessage, Surface } from "@/components/ui";
import { formatJaDateTime } from "@/lib/utils/date";
import { fetchActivityLogs, type ActivityLogView } from "../../_services/membersService";

/**
 * 操作ログ（誰がいつ何をしたか）。代表者と、操作ログを見る権限があるメンバーだけが開ける。
 * メンバーの参加・権限の変更・招待リンクの作成など、重要な操作だけが残る。新しい順に、続きは「もっと見る」で読む。
 */
export default function ActivityLogSection() {
  const [logs, setLogs] = useState<ActivityLogView[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (before?: string) => {
    try {
      const page = await fetchActivityLogs(before);
      setLogs((prev) => (before && prev ? [...prev, ...page.logs] : page.logs));
      setHasMore(page.hasMore);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作ログを読み込めませんでした");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMore = async () => {
    const last = logs?.[logs.length - 1];
    if (!last) return;
    setLoadingMore(true);
    await load(last.createdAt);
    setLoadingMore(false);
  };

  return (
    <section aria-labelledby="activity-heading" className="space-y-3">
      <h2 id="activity-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        操作ログ
      </h2>
      {error && (
        <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
          {error}
        </p>
      )}
      {logs && logs.length === 0 && <EmptyMessage message="まだ記録はありません" />}
      {logs && logs.length > 0 && (
        <Surface padding="none">
          <ul className="divide-y divide-line">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <p className="text-sm text-nicchyo-ink">{log.summary}</p>
                <p className="mt-0.5 text-xs text-nicchyo-ink/55">
                  {formatJaDateTime(log.createdAt)} ・ {log.actorName}
                </p>
              </li>
            ))}
          </ul>
        </Surface>
      )}
      {hasMore && (
        <div className="text-center">
          <Button variant="quiet" size="sm" onClick={handleMore} disabled={loadingMore}>
            {loadingMore ? "読み込んでいます…" : "もっと見る"}
          </Button>
        </div>
      )}
    </section>
  );
}
