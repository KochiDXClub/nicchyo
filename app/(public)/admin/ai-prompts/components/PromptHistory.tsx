"use client";

/**
 * 履歴とロールバック
 *
 * プロンプトは壊れやすいので、「昨日の状態に戻す」を1クリックでできるようにする。
 * 戻す操作は過去の行を有効化し直すのではなく、同じ本文で新しい版を作る
 * （履歴が「いつ何が使われていたか」の記録として一直線に残る）。
 */

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/lib/admin/toast";
import type { AiPromptDef, AiPromptKey } from "@/lib/grandma/prompts/promptKeys";

type PromptVersion = {
  id: string;
  key: string;
  body: string;
  version: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PromptHistory({
  def,
  onRestored,
  onClose,
}: {
  def: AiPromptDef;
  onRestored: () => void;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchHistory = useCallback(async (key: AiPromptKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-prompts/history?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { versions: PromptVersion[] };
      setVersions(data.versions);
    } catch {
      showToast.error("履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory(def.key);
  }, [def.key, fetchHistory]);

  const handleRestore = useCallback(
    async (version: number) => {
      setRestoring(version);
      try {
        const res = await fetch("/api/admin/ai-prompts/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: def.key, version }),
        });
        if (!res.ok) throw new Error("failed");
        showToast.success(`v${version} の内容に戻しました`);
        await fetchHistory(def.key);
        onRestored();
      } catch {
        showToast.error("戻せませんでした");
      } finally {
        setRestoring(null);
      }
    },
    [def.key, fetchHistory, onRestored]
  );

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-bold text-slate-900">{def.label} の履歴</h3>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[12px] text-slate-500 underline"
        >
          閉じる
        </button>
      </div>

      {loading ? (
        <p className="mt-2 text-[12px] text-slate-500">読み込み中...</p>
      ) : versions.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-500">
          まだ保存された版はありません。いまはコード側の既定値が使われています。
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {versions.map((version) => (
            <li key={version.id} className="rounded-md border border-slate-200 bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-700">
                  v{version.version}
                </span>
                {version.is_active ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    いま使用中
                  </span>
                ) : null}
                <span className="text-[12px] text-slate-500">
                  {formatDate(version.created_at)}
                </span>
                {version.note ? (
                  <span className="text-[12px] text-slate-500">— {version.note}</span>
                ) : null}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) =>
                        current === version.version ? null : version.version
                      )
                    }
                    className="text-[12px] text-slate-500 underline"
                  >
                    {expanded === version.version ? "本文を隠す" : "本文を見る"}
                  </button>
                  {!version.is_active ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(version.version)}
                      disabled={restoring !== null}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[12px] font-semibold text-slate-700 disabled:opacity-40"
                    >
                      {restoring === version.version ? "戻しています..." : "この版に戻す"}
                    </button>
                  ) : null}
                </div>
              </div>
              {expanded === version.version ? (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[12px] leading-relaxed text-slate-700">
                  {version.body}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
