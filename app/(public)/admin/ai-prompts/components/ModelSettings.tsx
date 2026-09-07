"use client";

/**
 * 場面ごとのAIモデル選択
 *
 * 選べるのは lib/ai/models.ts の AI_MODEL_DEFS に載っているモデルだけ。
 * 自由入力にすると、存在しないモデル名で全リクエストが落ちる形の事故になる。
 *
 * 推論の深さはモデルごとに受け付ける値が違うので、モデルを選び直したときに
 * 前のモデルでしか使えない値が残らないよう、選択肢から外れたら未指定に戻す。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import {
  AI_MODEL_DEFS,
  AI_MODEL_DEF_BY_ID,
  AI_USE_CASE_DEFS,
  DEFAULT_AI_MODEL_SETTINGS,
  type AiModelSettingSet,
  type AiUseCase,
  type ReasoningEffort,
} from "@/lib/ai/models";

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: "考えない（最速）",
  minimal: "ほぼ考えない（最速）",
  low: "少し考える",
  medium: "ふつうに考える",
  high: "よく考える",
  xhigh: "とてもよく考える",
  max: "最大まで考える",
};

/** 1質問あたりの目安。相談1回のおおよその実測値（入力1,200 / 出力250 token）で計算する */
const TOKENS_PER_ASK = { input: 1200, output: 250 };

function estimateCostYen(modelId: string): string | null {
  const def = AI_MODEL_DEF_BY_ID.get(modelId);
  if (!def) return null;
  const usd =
    (TOKENS_PER_ASK.input * def.pricing.input + TOKENS_PER_ASK.output * def.pricing.output) / 1e6;
  // 為替は目安。桁感が伝わればよいので固定でよい
  const yen = usd * 150;
  return `1回あたり約 ${yen.toFixed(3)} 円`;
}

function UseCaseRow({
  useCase,
  label,
  description,
  value,
  savedAt,
  onChange,
}: {
  useCase: AiUseCase;
  label: string;
  description: string;
  value: { modelId: string; reasoningEffort?: ReasoningEffort };
  savedAt?: string;
  onChange: (useCase: AiUseCase, next: { modelId: string; reasoningEffort?: ReasoningEffort }) => void;
}) {
  const def = AI_MODEL_DEF_BY_ID.get(value.modelId);
  const efforts = def?.reasoningEfforts ?? [];
  const isDefault = value.modelId === DEFAULT_AI_MODEL_SETTINGS[useCase].modelId;

  const handleModelChange = useCallback(
    (modelId: string) => {
      const next = AI_MODEL_DEF_BY_ID.get(modelId);
      // 前のモデルでしか使えない深さが残ると、保存時に弾かれる
      const keepEffort =
        value.reasoningEffort && next?.reasoningEfforts.includes(value.reasoningEffort)
          ? value.reasoningEffort
          : undefined;
      onChange(useCase, { modelId, reasoningEffort: keepEffort });
    },
    [onChange, useCase, value.reasoningEffort]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        {isDefault ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            既定のまま
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-slate-500">{description}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`model-${useCase}`}
            className="text-[12px] font-semibold text-slate-600"
          >
            使うモデル
          </label>
          <select
            id={`model-${useCase}`}
            value={value.modelId}
            onChange={(event) => handleModelChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
          >
            {AI_MODEL_DEFS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {efforts.length > 0 ? (
          <div>
            <label
              htmlFor={`effort-${useCase}`}
              className="text-[12px] font-semibold text-slate-600"
            >
              どれくらい考えさせるか
            </label>
            <select
              id={`effort-${useCase}`}
              value={value.reasoningEffort ?? ""}
              onChange={(event) =>
                onChange(useCase, {
                  modelId: value.modelId,
                  reasoningEffort: (event.target.value || undefined) as
                    | ReasoningEffort
                    | undefined,
                })
              }
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-[13px] text-slate-800 focus:border-slate-400 focus:outline-none"
            >
              <option value="">おまかせ（{EFFORT_LABELS[efforts[0]]}）</option>
              {efforts.map((effort) => (
                <option key={effort} value={effort}>
                  {EFFORT_LABELS[effort]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {def ? (
        <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
          {def.description}
          <span className="ml-1 whitespace-nowrap text-slate-400">
            （{estimateCostYen(def.id)}）
          </span>
        </p>
      ) : null}

      {savedAt ? (
        <p className="mt-2 text-[11px] text-slate-400">
          最終更新: {new Date(savedAt).toLocaleString("ja-JP")}
        </p>
      ) : null}
    </div>
  );
}

export function ModelSettings() {
  const [saved, setSaved] = useState<AiModelSettingSet>(DEFAULT_AI_MODEL_SETTINGS);
  const [draft, setDraft] = useState<AiModelSettingSet>(DEFAULT_AI_MODEL_SETTINGS);
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-models");
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as {
        settings: AiModelSettingSet;
        savedAt: Record<string, string>;
      };
      setSaved(json.settings);
      setDraft(json.settings);
      setSavedAt(json.savedAt ?? {});
    } catch {
      showToast.error("モデル設定の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = useCallback(
    (useCase: AiUseCase, next: { modelId: string; reasoningEffort?: ReasoningEffort }) => {
      setDraft((current) => ({ ...current, [useCase]: next }));
    },
    []
  );

  const changed = useMemo(
    () =>
      AI_USE_CASE_DEFS.filter(
        (def) =>
          draft[def.useCase].modelId !== saved[def.useCase].modelId ||
          draft[def.useCase].reasoningEffort !== saved[def.useCase].reasoningEffort
      ).map((def) => def.useCase),
    [draft, saved]
  );

  const handleSave = useCallback(async () => {
    if (changed.length === 0) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(changed.map((useCase) => [useCase, draft[useCase]]));
      const res = await fetch("/api/admin/ai-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success("保存しました");
      await load();
    } catch {
      showToast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [changed, draft, load]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">使うAIモデル</h2>
        <p className="text-[13px] text-slate-500">
          場面ごとに別のモデルを割り当てられます。速さが体験に直結する相談・チャットと、
          じっくり考えさせたい回り方プランでは、向いているモデルが違います。
        </p>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
        変更すると<strong>次の質問からすぐ反映されます</strong>。
        モデルを変えると返事の文体や長さも変わるので、切り替えたあとは実際に
        相談ページで1〜2問試してください。おかしければ元のモデルに選び直せば戻ります。
      </p>

      {loading ? (
        <p className="text-[13px] text-slate-500">読み込み中...</p>
      ) : (
        <>
          {AI_USE_CASE_DEFS.map((def) => (
            <UseCaseRow
              key={def.useCase}
              useCase={def.useCase}
              label={def.label}
              description={def.description}
              value={draft[def.useCase]}
              savedAt={savedAt[def.useCase]}
              onChange={handleChange}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <LoadingButton
              onClick={handleSave}
              isLoading={saving}
              loadingText="保存中..."
              disabled={changed.length === 0}
              className="rounded-md bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white"
            >
              {changed.length > 0 ? `${changed.length}件を保存` : "変更なし"}
            </LoadingButton>
            {changed.length > 0 ? (
              <button
                type="button"
                onClick={() => setDraft(saved)}
                className="text-[13px] text-slate-500 underline"
              >
                変更を取り消す
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
