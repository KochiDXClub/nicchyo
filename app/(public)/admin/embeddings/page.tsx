"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminLayout, AdminPageHeader, LoadingButton } from "@/components/admin";
import { Badge, Button, buttonClass } from "@/components/ui";
import { showToast } from "@/lib/admin/toast";
import type { EmbeddingSyncHistory, EmbeddingSyncRunRow } from "@/types/database.extensions";

type Target = EmbeddingSyncRunRow["target"];

const targets = {
  vendors: { label: "店舗データ", detail: "掲載を許可された店舗の情報を、にちよさんの検索に反映します。" },
  knowledge: { label: "案内知識", detail: "公開済みの案内データをもとに、にちよさんが検索する案内知識を更新します。" },
} satisfies Record<Target, { label: string; detail: string }>;

const statuses = {
  running: { label: "実行中", variant: "info" },
  succeeded: { label: "完了", variant: "neutral" },
  failed: { label: "失敗", variant: "caution" },
  interrupted: { label: "完了を確認できず", variant: "caution" },
} as const;

const sources = { manual: "手動", scheduled: "定期", script: "スクリプト" } satisfies Record<EmbeddingSyncRunRow["source"], string>;

const dateTime = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Asia/Tokyo",
});

export default function EmbeddingsPage() {
  const [history, setHistory] = useState<EmbeddingSyncHistory | null>(null);
  const runs = history?.runs;
  const [historyError, setHistoryError] = useState(false);
  const [pending, setPending] = useState<Target | null>(null);
  const historyRequest = useRef<AbortController | null>(null);

  const refreshHistory = useCallback(async () => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    try {
      const response = await fetch("/api/admin/embedding-runs", { signal: controller.signal });
      if (!response.ok) throw new Error("Could not load runs");
      const data: EmbeddingSyncHistory = await response.json();
      if (controller.signal.aborted) return;
      setHistory(data);
      setHistoryError(false);
    } catch {
      if (!controller.signal.aborted) setHistoryError(true);
    } finally {
      if (historyRequest.current === controller) historyRequest.current = null;
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
    return () => historyRequest.current?.abort();
  }, [refreshHistory]);

  const hasRunning = runs?.some((run) => run.status === "running") ?? false;
  useEffect(() => {
    if (!pending && !hasRunning) return;
    const timer = window.setInterval(() => {
      if (!historyRequest.current) void refreshHistory();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [pending, hasRunning, refreshHistory]);

  async function updateEmbeddings(target: Target) {
    setPending(target);
    try {
      const response = await fetch("/api/admin/sync-embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (response.status === 409) {
        showToast.error("この対象はすでに更新中です。実行履歴をご確認ください。");
        return;
      }
      if (!response.ok) throw new Error("Could not update embeddings");
      const result: { processed: number; version: number } = await response.json();
      showToast.success(`${targets[target].label}の第${result.version}版を反映しました（${result.processed}件）`);
    } catch {
      showToast.error("更新の完了を確認できませんでした。実行履歴をご確認ください。");
    } finally {
      setPending(null);
      void refreshHistory();
    }
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="システム"
        title="埋め込み管理"
        description="にちよさんが検索に使うデータを更新し、実行結果を確認できます。"
      />
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["vendors", "knowledge"] as const).map((target) => {
            const running = runs?.some((run) => run.target === target && run.status === "running");
            const isUpdating = pending === target || running === true;
            return (
              <section key={target} className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-nicchyo-ink">{targets[target].label}</h2>
                  {history && <Badge variant="info">使用中 · 第{history[target]}版</Badge>}
                </div>
                <p className="flex-1 text-sm text-nicchyo-ink/70">{targets[target].detail}</p>
                <LoadingButton
                  className={buttonClass({ variant: target === "vendors" ? "primary" : "secondary" })}
                  isLoading={isUpdating}
                  loadingText="更新中"
                  disabled={pending !== null}
                  onClick={() => void updateEmbeddings(target)}
                >
                  {targets[target].label}を更新
                </LoadingButton>
              </section>
            );
          })}
        </div>

        <section aria-labelledby="embedding-history-heading" className="rounded-card border border-line bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="embedding-history-heading" className="font-bold text-nicchyo-ink">実行履歴</h2>
              <p className="text-sm text-nicchyo-ink/70">直近30件 · 日本時間</p>
            </div>
            <Button variant="quiet" size="sm" onClick={() => void refreshHistory()}>履歴を再読み込み</Button>
          </div>
          {historyError && <p role="alert" className="text-sm text-status-critical-fg">実行履歴を取得できませんでした。再読み込みしてください。</p>}
          {history === null && !historyError && <p role="status" className="text-sm text-nicchyo-ink/70">読み込み中…</p>}
          {!historyError && runs?.length === 0 && <p className="text-sm text-nicchyo-ink/70">実行履歴はまだありません。</p>}
          {runs && runs.length > 0 && (
            <ul className="divide-y divide-line">
              {runs.map((run) => (
                <li key={run.id} className="grid gap-1 py-3 text-sm sm:grid-cols-2 sm:items-center">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-nicchyo-ink">{targets[run.target].label}</span>
                    <Badge variant={statuses[run.status].variant}>{statuses[run.status].label}</Badge>
                    <span className="text-nicchyo-ink/70">{sources[run.source]}</span>
                    {run.version_number !== null && <span className="text-nicchyo-ink/70">第{run.version_number}版</span>}
                    {run.processed_count !== null && (
                      <span className="text-nicchyo-ink/70">
                        {run.processed_count.toLocaleString("ja-JP")}件{run.status === "succeeded" ? "反映" : "生成済み（反映なし）"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-nicchyo-ink/70 sm:text-right">
                    <div>開始 <time dateTime={run.started_at}>{dateTime.format(new Date(run.started_at))}</time></div>
                    {run.finished_at && <div>終了 <time dateTime={run.finished_at}>{dateTime.format(new Date(run.finished_at))}</time></div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
